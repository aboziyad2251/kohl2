"""Real session/API checks in a disposable loopback-only database copy.

Fixtures and credentials stay on the VPS. Production is read only (pg_dump).
The copy is never sent to TestSprite and is dropped when acceptance completes.
"""
import base64, hashlib, hmac, http.server, json, os, pathlib, socketserver, subprocess, threading, time, urllib.request, urllib.error, uuid
from urllib.parse import urlsplit, urlunsplit
os.umask(0o077)
stage = pathlib.Path('/home/debian/projects/kohl-attention-release')
built = json.loads((stage / 'attention-build.json').read_text())
private = stage / '.portal-stage'; private.mkdir(mode=0o700, exist_ok=True)
DB = 'kohl_attention_qa_20261008'
APP = 'http://127.0.0.1:39060'; GATEWAY = 'http://127.0.0.1:39063'
names = ['kohl-attention-qa-auth', 'kohl-attention-qa-rest', 'kohl-attention-qa-app']
def run(command, payload=None):
    result = subprocess.run(command, input=payload, capture_output=True)
    if result.returncode:
        (private / 'failure.log').write_bytes(result.stdout + result.stderr)
        raise RuntimeError('QA operation failed; see private failure.log')
    return result.stdout
def inspect(name): return json.loads(run(['docker', 'inspect', name]))[0]
def env(container): return dict(x.split('=', 1) for x in container['Config']['Env'])
def sql(query, database=DB):
    assert database == DB, 'Fixture SQL is isolated'
    return run(['docker', 'exec', '-i', 'supabase-db', 'psql', '-X', '-U', 'supabase_admin', '-d', database, '-At', '-v', 'ON_ERROR_STOP=1'], query.encode()).decode().strip()
assert DB.startswith('kohl_attention_qa_') and DB != 'postgres'
assert run(['docker', 'exec', 'supabase-db', 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-At', '-c', "select count(*) from pg_database where datname='" + DB + "'"]).decode().strip() == '0', 'QA database exists; inspect before rerun'
known = set(run(['docker', 'ps', '-a', '--format', '{{.Names}}']).decode().splitlines())
assert not any(name in known for name in names), 'QA service exists; inspect before rerun'
address = inspect('supabase-db')['NetworkSettings']['Networks']['supabase_default']['IPAddress']
secret = uuid.uuid4().hex + uuid.uuid4().hex
def key(role):
    encode = lambda x: base64.urlsafe_b64encode(json.dumps(x, separators=(',', ':')).encode()).rstrip(b'=')
    body = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode({'role': role, 'aud': 'authenticated', 'exp': int(time.time()) + 3600})
    return (body + b'.' + base64.urlsafe_b64encode(hmac.new(secret.encode(), body, hashlib.sha256).digest()).rstrip(b'=')).decode()
anon, service = key('anon'), key('service_role')
def replace_db(uri):
    parsed = urlsplit(uri)
    return urlunsplit((parsed.scheme, parsed.netloc.replace(parsed.hostname, address), '/' + DB, parsed.query, parsed.fragment))
def start(name, image, config):
    command = ['docker', 'run', '-d', '--name', name, '--network', 'host']
    for k, v in config.items(): command += ['-e', k + '=' + v]
    run(command + [image])
def call(base, path, token=None, body=None):
    request = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers={'Content-Type': 'application/json', 'apikey': anon, 'Authorization': 'Bearer ' + (token or anon)})
    try:
        with urllib.request.urlopen(request, timeout=30) as response: return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        error.read(); return error.code, {}
class Gateway(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def route(self):
        mapping = {'/auth/v1/': 39062, '/rest/v1/': 39061}
        prefix = next((p for p in mapping if self.path.startswith(p)), None)
        if not prefix: self.send_error(404); return
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))) if self.command == 'POST' else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in ['host', 'connection', 'content-length']}
        request = urllib.request.Request('http://127.0.0.1:' + str(mapping[prefix]) + '/' + self.path[len(prefix):], data=body, method=self.command, headers=headers)
        try: response = urllib.request.urlopen(request, timeout=30)
        except urllib.error.HTTPError as error: response = error
        content = response.read(); self.send_response(response.status)
        self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(content))); self.end_headers(); self.wfile.write(content)
    do_GET = route; do_POST = route
socketserver.ThreadingTCPServer.allow_reuse_address = True
gateway = None
created = False
try:
    # The consistent dump is kept only in memory and restored locally, never exported.
    dump = run(['docker', 'exec', 'supabase-db', 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc'])
    run(['docker', 'exec', 'supabase-db', 'createdb', '-U', 'supabase_admin', DB]); created = True
    run(['docker', 'exec', '-i', 'supabase-db', 'pg_restore', '-U', 'supabase_admin', '-d', DB, '--exit-on-error'], dump)
    gateway = socketserver.ThreadingTCPServer(('127.0.0.1', 39063), Gateway)
    threading.Thread(target=gateway.serve_forever, daemon=True).start()
    auth = inspect('supabase-auth'); authenv = env(auth)
    authenv.update({'GOTRUE_DB_DATABASE_URL': replace_db(authenv['GOTRUE_DB_DATABASE_URL']), 'GOTRUE_JWT_SECRET': secret, 'GOTRUE_API_HOST': '127.0.0.1', 'GOTRUE_API_PORT': '39062', 'API_HOST': '127.0.0.1', 'API_PORT': '39062', 'API_EXTERNAL_URL': GATEWAY + '/auth/v1', 'GOTRUE_SITE_URL': APP, 'GOTRUE_DISABLE_SIGNUP': 'true', 'GOTRUE_EXTERNAL_GOOGLE_ENABLED': 'false', 'GOTRUE_EXTERNAL_GOOGLE_SECRET': '', 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID': ''})
    start(names[0], auth['Config']['Image'], authenv)
    rest = inspect('supabase-rest'); restenv = env(rest)
    restenv.update({'PGRST_DB_URI': replace_db(restenv['PGRST_DB_URI']), 'PGRST_JWT_SECRET': secret, 'PGRST_SERVER_PORT': '39061', 'PGRST_SERVER_HOST': '127.0.0.1'})
    start(names[1], rest['Config']['Image'], restenv)
    appenv = env(inspect('kohl_crm_app'))
    appenv.update({'SUPABASE_SERVER_URL': GATEWAY, 'SUPABASE_SERVICE_ROLE_KEY': service, 'NEXT_PUBLIC_SUPABASE_ANON_KEY': anon, 'PORT': '39060', 'HOSTNAME': '127.0.0.1', 'APP_ORIGIN': APP, 'PASSWORD_RECOVERY_ENABLED': 'false'})
    start(names[2], built['image_id'], appenv)
    for _ in range(40):
        try:
            if urllib.request.urlopen(APP + '/login', timeout=3).status == 200 and urllib.request.urlopen('http://127.0.0.1:39062/health', timeout=3).status == 200: break
        except Exception: pass
        time.sleep(1)
    else: raise AssertionError('QA services did not start')
    users, sessions = {}, {}
    for role in ['ADMIN', 'CEO', 'TENANT_A', 'TENANT_B', 'OWNER', 'BROKER']:
        email, password = str(uuid.uuid4()) + '@test.invalid', uuid.uuid4().hex + '!Aa'
        status, identity = call('http://127.0.0.1:39062', '/admin/users', service, {'email': email, 'password': password, 'email_confirm': True})
        assert status in [200, 201]
        uid = identity['id']; users[role] = uid
        sql("insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values ('" + uid + "','QA attention','0500000000','" + role.split('_')[0] + "',true)")
        status, session = call('http://127.0.0.1:39062', '/token?grant_type=password', anon, {'email': email, 'password': password})
        assert status == 200; sessions[role] = session['access_token']
    property_id, contract_id, due_id = str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4())
    lessor = sql('select id from public.lessors limit 1')
    assert lessor, 'Isolated source must have a lessor'
    sql("insert into public.properties(id,property_name,property_type,address,city,lessor_id) values ('" + property_id + "','QA attention property','Residential','QA','Riyadh','" + lessor + "'); insert into public.contracts(id,contract_number,type,property_id,lessor_id,tenant_name,tenant_national_id,rent_amount,payment_schedule,start_date,end_date,status,unit_label) values ('" + contract_id + "','ATTENTION-QA','RESIDENTIAL','" + property_id + "','" + lessor + "','QA tenant','0000000000',12000,'Monthly',current_date-30,current_date+20,'active','QA-1'); insert into portal_private.tenant_lease_links values ('" + users['TENANT_A'] + "','" + contract_id + "',now()); insert into portal_private.owner_property_links(owner_user_id,property_id,ownership_share,effective_from) values ('" + users['OWNER'] + "','" + property_id + "',100,current_date-30); insert into portal_private.payment_dues(id,contract_id,kind,description,due_date,period_start,period_end,amount) values ('" + due_id + "','" + contract_id + "','rent','QA overdue',current_date-5,current_date-30,current_date,1000)")
    for role in ['ADMIN', 'CEO', 'TENANT_A', 'OWNER']:
        status, summary = call(APP, '/api/portal/attention', sessions[role])
        assert status == 200
        assert any(item['id'] == 'due:' + due_id for item in summary['items'])
        assert summary['metrics']['overdueRent'] >= 1000
    for role in ['TENANT_B', 'BROKER']:
        status, summary = call(APP, '/api/portal/attention', sessions[role])
        # Tenant accounts without an active lease may be denied by portal_me;
        # that is valid isolation, rather than an empty but authorized dashboard.
        assert status in [200, 403], 'Unexpected result for an unassigned account'
        if status == 200: assert not summary['items'], 'Foreign assignment leaked into notifications'
        print(role + ': unassigned account HTTP ' + str(status) + '; no foreign records exposed')
    assert call(APP, '/api/portal/attention')[0] == 401
    assert call(APP, '/api/portal/attention', service)[0] in [401, 403], 'Service token must not impersonate a user'
    sql("update portal_private.accounts set is_active=false where user_id='" + users['TENANT_A'] + "'")
    assert call(APP, '/api/portal/attention', sessions['TENANT_A'])[0] == 403, 'Deactivated session retained access'
    assert json.load(urllib.request.urlopen(APP + '/api/auth/providers'))['recovery'] is False
    assert inspect(names[2])['Image'] == built['image_id']
    (stage / 'attention-acceptance.json').write_text(json.dumps({'passed': True, 'image_id': built['image_id'], 'real_isolated_sessions': True, 'cross_account_denial': True, 'deactivation_denial': True}))
    print('Real isolated action API checks passed: executives/customer scopes, foreign-assignment isolation, missing/forged identity, immediate deactivation and recovery gating')
finally:
    if gateway: gateway.shutdown(); gateway.server_close()
    for name in names:
        assert name.startswith('kohl-attention-qa-')
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if created: run(['docker', 'exec', 'supabase-db', 'dropdb', '-U', 'supabase_admin', '--force', DB])
    print('This release\'s isolated services/database removed; production and older backups preserved')
