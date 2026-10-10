"""Real session/API checks in a disposable loopback-only database copy.

Fixtures and credentials stay on the VPS. Production is read only (pg_dump).
The copy is never sent to TestSprite and is dropped when acceptance completes.
"""
import base64, hashlib, hmac, http.server, json, os, pathlib, socketserver, subprocess, threading, time, urllib.request, urllib.error, uuid
from urllib.parse import urlsplit, urlunsplit
os.umask(0o077)
stage = pathlib.Path('/home/debian/projects/kohl-cooperation-release-20261010')
built = json.loads((stage / 'standard-build.json').read_text())
private = stage / '.portal-stage'; private.mkdir(mode=0o700, exist_ok=True)
DB = 'kohl_cooperation_qa_20261010'
APP = 'http://127.0.0.1:39170'; GATEWAY = 'http://127.0.0.1:39173'
names = ['kohl-cooperation-qa-auth', 'kohl-cooperation-qa-rest', 'kohl-cooperation-qa-app']
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
assert DB.startswith('kohl_cooperation_qa_') and DB != 'postgres'
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
        mapping = {'/auth/v1/': 39172, '/rest/v1/': 39171}
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

from concurrent.futures import ThreadPoolExecutor
gateway=None
created=False
try:
    # The consistent dump is kept only in memory and restored locally, never exported.
    dump = run(['docker', 'exec', 'supabase-db', 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc'])
    run(['docker', 'exec', 'supabase-db', 'createdb', '-U', 'supabase_admin', DB]); created = True
    run(['docker', 'exec', '-i', 'supabase-db', 'pg_restore', '-U', 'supabase_admin', '-d', DB, '--exit-on-error'], dump)
    # The new additive migration is tested only in this disposable restored database.
    sql((stage / 'supabase/migrations/20261010174132_broker_cooperation_form.sql').read_text(encoding='utf-8-sig'))
    gateway = socketserver.ThreadingTCPServer(('127.0.0.1', 39173), Gateway)
    threading.Thread(target=gateway.serve_forever, daemon=True).start()
    auth = inspect('supabase-auth'); authenv = env(auth)
    authenv.update({'GOTRUE_DB_DATABASE_URL': replace_db(authenv['GOTRUE_DB_DATABASE_URL']), 'GOTRUE_JWT_SECRET': secret, 'GOTRUE_API_HOST': '127.0.0.1', 'GOTRUE_API_PORT': '39172', 'API_HOST': '127.0.0.1', 'API_PORT': '39172', 'API_EXTERNAL_URL': GATEWAY + '/auth/v1', 'GOTRUE_SITE_URL': APP, 'GOTRUE_DISABLE_SIGNUP': 'true', 'GOTRUE_EXTERNAL_GOOGLE_ENABLED': 'false', 'GOTRUE_EXTERNAL_GOOGLE_SECRET': '', 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID': ''})
    start(names[0], auth['Config']['Image'], authenv)
    rest = inspect('supabase-rest'); restenv = env(rest)
    restenv.update({'PGRST_DB_URI': replace_db(restenv['PGRST_DB_URI']), 'PGRST_JWT_SECRET': secret, 'PGRST_SERVER_PORT': '39171', 'PGRST_SERVER_HOST': '127.0.0.1'})
    start(names[1], rest['Config']['Image'], restenv)
    appenv = env(inspect('kohl_crm_app'))
    appenv.update({'SUPABASE_SERVER_URL': GATEWAY, 'SUPABASE_SERVICE_ROLE_KEY': service, 'NEXT_PUBLIC_SUPABASE_ANON_KEY': anon, 'PORT': '39170', 'HOSTNAME': '127.0.0.1', 'APP_ORIGIN': APP, 'PASSWORD_RECOVERY_ENABLED': 'false'})
    start(names[2], built['image_id'], appenv)
    for _ in range(40):
        try:
            if urllib.request.urlopen(APP + '/login', timeout=3).status == 200 and urllib.request.urlopen('http://127.0.0.1:39172/health', timeout=3).status == 200: break
        except Exception: pass
        time.sleep(1)
    else: raise AssertionError('QA services did not start')
    users,sessions={},{}
    for role in ['ADMIN','CEO','EMPLOYEE','HR','TENANT','OWNER','BROKER']:
        email,password=str(uuid.uuid4())+'@test.invalid',uuid.uuid4().hex+'!Aa'
        status,identity=call('http://127.0.0.1:39172','/admin/users',service,{'email':email,'password':password,'email_confirm':True,'user_metadata':{'role':'ADMIN'}})
        assert status in [200,201], 'Fixture identity creation failed'
        uid=identity['id'];users[role]=uid
        sql("insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values ('"+uid+"','QA bills','0500000000','"+role+"',true)")
        status,session=call('http://127.0.0.1:39172','/token?grant_type=password',anon,{'email':email,'password':password})
        assert status==200,'Isolated password login failed'
        sessions[role]=session['access_token']
    forms=json.loads((stage/'standard-fixtures.json').read_text())
    form=forms['KP']
    issue=lambda role='ADMIN',f=form,rid=None:call(APP,'/api/bills-forms/standard',sessions[role],{'requestId':rid or str(uuid.uuid4()),'form':f})
    for role in ['ADMIN','CEO','EMPLOYEE']:
        for code,f in forms.items():
            status,issued=issue(role,f)
            assert status==200 and issued['number'].startswith(code+'-2026-'), 'Issue failed for '+role+'/'+code
            assert issued['form']==f,'Snapshot mismatch'
    oldform={'kind':'INV','invoiceType':'rent','party':'QA bills client','unit':'QA-12','date':'2026-10-10','amount':'100.01','vat':True,'method':'نقداً','reference':'QA','notes':'QA only','nature':'إيراد للمكتب','bank':'','iban':'','condition':'','keys':''}
    for code in ['REC','VOU','INV','HND']:
        legacy={**oldform,'kind':code,'vat':code=='INV'}
        assert call(APP,'/api/bills-forms',sessions['ADMIN'],{'requestId':str(uuid.uuid4()),'form':legacy})[0]==200,'Existing form regression'
    for role in ['HR','TENANT','OWNER','BROKER']:
        assert issue(role)[0]==403,role+' acquired issuance permission from Auth metadata'
        assert call(GATEWAY,'/rest/v1/rpc/issue_standard_form',sessions[role],{'request_id':str(uuid.uuid4()),'payload':form})[0]==403,'Direct RPC bypass for '+role
    assert call(APP,'/api/bills-forms/standard',body={'form':form,'requestId':str(uuid.uuid4())})[0]==401
    assert call(APP,'/api/bills-forms/standard',service,{'form':form,'requestId':str(uuid.uuid4())})[0] in [401,403]
    with ThreadPoolExecutor(max_workers=10) as pool:batch=list(pool.map(lambda _:issue('EMPLOYEE'),range(20)))
    assert all(s==200 for s,_ in batch),'Concurrent request failed'
    numbers=[int(d['number'].rsplit('-',1)[1]) for _,d in batch]
    assert len(set(numbers))==20 and max(numbers)-min(numbers)==19,'Concurrent allocation collision/gap'
    rid=str(uuid.uuid4())
    with ThreadPoolExecutor(max_workers=5) as pool:retries=list(pool.map(lambda _:issue('ADMIN',form,rid),range(5)))
    assert all(s==200 for s,_ in retries) and len({d['number'] for _,d in retries})==1,'Retry not idempotent'
    assert issue('ADMIN',{**form,'values':{**form['values'],'client':'Changed'}},rid)[0]==400,'Changed retry payload accepted'
    assert issue('CEO',form,rid)[0]==403,'Foreign request ID accessible'
    assert issue('EMPLOYEE',{**form,'override':'KP-2026-00500'})[0]==403
    assert call(GATEWAY,'/rest/v1/rpc/issue_standard_form',sessions['EMPLOYEE'],{'request_id':str(uuid.uuid4()),'payload':{**form,'override':'KP-2026-00500'}})[0]==403
    assert issue('CEO',{**form,'override':'KP-2026-00500'})[0]==200
    assert issue('ADMIN',{**form,'override':'KP-2026-00500'})[0]==409,'Override collision not rejected'
    assert issue('ADMIN')[1]['number']=='KP-2026-00501','Override failed to advance counter'
    assert issue('ADMIN',{**form,'date':'2027-01-01'})[1]['number']=='KP-2027-00001','Annual reset failed'
    assert issue('ADMIN',{**forms['KC-L'],'override':'KC-L-2026-00500'})[0]==200
    assert issue('ADMIN',forms['KC-L'])[1]['number']=='KC-L-2026-00501','Hyphenated kind sequence failed'
    bads=[{**form,'date':'2026-02-30'},{**form,'kind':'REC'},{**form,'override':'KL-2026-00001'},{**form,'override':'KP-2026-00000'},{**form,'values':{**form['values'],'client':''}},{**form,'values':{**form['values'],'fixed_clause':'tamper'}},{**form,'values':{**form['values'],'fee.0.amount':'-1'}},{**form,'values':{**form['values'],'fee.0.amount':'1.001'}},{**forms['KC-L'],'values':{**forms['KC-L']['values'],'rent':'1'}},{**forms['KC-B'],'values':{**forms['KC-B']['values'],'percentage':'101'}},{**forms['KM'],'values':{**forms['KM']['values'],'importance':'invalid'}},{**forms['KS'],'values':{**forms['KS']['values'],'from':'2027-01-01'}}]
    bads.append({**forms['KC-M'],'values':{**forms['KC-M']['values'],'brokerShare':'101'}})
    for bad in bads:
        assert issue('ADMIN',bad)[0]==400,'Invalid API input accepted'
        assert call(GATEWAY,'/rest/v1/rpc/issue_standard_form',sessions['ADMIN'],{'request_id':str(uuid.uuid4()),'payload':bad})[0]==400,'Invalid direct RPC input accepted'
    before=sql("select last_value from portal_private.bill_counters where kind='KP' and year=2026")
    sql("create function portal_private.qa_fail_standard() returns trigger language plpgsql as $$ begin if new.snapshot->'form'->'values'->>'client'='QA FAIL' then raise exception 'QA forced failure'; end if; return new; end $$; create trigger qa_fail_standard before insert on portal_private.bill_forms for each row execute function portal_private.qa_fail_standard();")
    assert issue('ADMIN',{**form,'values':{**form['values'],'client':'QA FAIL'}})[0]!=200
    assert sql("select last_value from portal_private.bill_counters where kind='KP' and year=2026")==before,'Failed snapshot consumed a number'
    assert issue('ADMIN')[1]['number']=='KP-2026-'+str(int(before)+1).zfill(5)
    assert sql("select count(*) from portal_private.bill_forms where snapshot->>'templateVersion'='2'")!='0'
    sql("update portal_private.accounts set is_active=false where user_id='"+users['EMPLOYEE']+"'")
    assert issue('EMPLOYEE')[0]==403,'Deactivated API session accepted'
    assert call(GATEWAY,'/rest/v1/rpc/issue_standard_form',sessions['EMPLOYEE'],{'request_id':str(uuid.uuid4()),'payload':form})[0]==403,'Deactivated direct RPC accepted'
    assert sql("select has_table_privilege('authenticated','portal_private.bill_forms','SELECT') or has_table_privilege('authenticated','portal_private.bill_forms','UPDATE') or has_table_privilege('authenticated','portal_private.bill_forms','DELETE') or has_table_privilege('authenticated','portal_private.bill_counters','UPDATE') or has_function_privilege('anon','public.issue_standard_form(uuid,jsonb)','EXECUTE')")=='f','Private grants too broad'
    assert sql("select count(*) from pg_class where oid in ('portal_private.bill_forms'::regclass,'portal_private.bill_counters'::regclass) and relrowsecurity")=='2'
    assert inspect(names[2])['Image']==built['image_id']
    (stage/'standard-acceptance.json').write_text(json.dumps({'passed':True,'image_id':built['image_id'],'migration_sha':built['migration_sha'],'real_isolated_sessions':True,'concurrent_allocations':20,'idempotent_retries':5,'role_and_deactivation_denial':True,'snapshot_rollback':True,'restored_backup':True}))
    print('PASS: real isolated Auth/API/RPC; eleven standard kinds + four legacy; 20 concurrent numbers; 5 idempotent retries; overrides; annual reset; validation; invalid inputs; role/metadata/deactivation denial; RLS/grants; rollback')
finally:
    if gateway:gateway.shutdown();gateway.server_close()
    for name in names:
        assert name.startswith('kohl-cooperation-qa-')
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if created:run(['docker','exec','supabase-db','dropdb','-U','supabase_admin','--force',DB])
    print('Removed only this release QA database/services; production unchanged')

