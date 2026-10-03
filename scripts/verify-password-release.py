"""VPS operator: isolated password account tests; read-only executive production checks.

Never prints tokens or passwords. Does not provision production identities.
"""
import json, pathlib, subprocess, time, urllib.request, urllib.error, uuid, base64, hashlib, hmac
from urllib.parse import urlparse

def inspect(name):
    return json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]
def environment(container):
    return dict(x.split('=', 1) for x in container['Config']['Env'] if '=' in x)
def call(base, path, key, token=None, payload=None, method=None):
    req = urllib.request.Request(base + path, data=json.dumps(payload).encode() if payload is not None else None,
        method=method, headers={'Content-Type':'application/json', 'apikey':key, 'Authorization':'Bearer ' + (token or key)})
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            raw=response.read(); return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        try: body=json.loads(error.read())
        except Exception: body={}
        return error.code, body
def sql(database, query):
    assert database.startswith('kohl_cutover_') and database != 'postgres'
    return subprocess.check_output(['docker','exec','supabase-db','psql','-X','-U','supabase_admin','-d',database,'-At','-v','ON_ERROR_STOP=1','-c',query]).decode().strip()

rest=inspect('kohl-cutover-preview-rest')
database=urlparse(environment(rest)['PGRST_DB_URI']).path.lstrip('/')
assert database.startswith('kohl_cutover_') and database != 'postgres'
preview=inspect('kohl-cutover-preview-app'); env=environment(preview)
auth_env=environment(inspect('kohl-cutover-preview-auth'))
assert urlparse(auth_env['GOTRUE_DB_DATABASE_URL']).path.lstrip('/') == database
secret=auth_env['GOTRUE_JWT_SECRET']
assert secret == environment(rest)['PGRST_JWT_SECRET']
def jwt(role):
    encode=lambda value: base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
    body=encode({'alg':'HS256','typ':'JWT'})+b'.'+encode({'role':role,'aud':'authenticated','exp':int(time.time())+3600})
    return (body+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),body,hashlib.sha256).digest()).rstrip(b'=')).decode()
env['NEXT_PUBLIC_SUPABASE_ANON_KEY']=jwt('anon'); env['SUPABASE_SERVICE_ROLE_KEY']=jwt('service_role')
network=next(iter(preview['NetworkSettings']['Networks']))
command=['docker','run','-d','--name','kohl-password-preview','--network',network,
    '-e','PORT=39041','-e','HOSTNAME=127.0.0.1']
assert network == 'host', 'This verifier expects the existing host-network preview'
for name,value in env.items():
    if name in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVER_URL','SUPABASE_SERVICE_ROLE_KEY','APP_ORIGIN','GOOGLE_LOGIN_ENABLED']:
        command += ['-e', name + '=' + value]
command += ['kohl-passwords:20261004']
subprocess.run(command,check=True,stdout=subprocess.DEVNULL)
key=env['NEXT_PUBLIC_SUPABASE_ANON_KEY']; service=env['SUPABASE_SERVICE_ROLE_KEY']
# The isolated gateway is published by the existing test container.
gateway='http://127.0.0.1:' + environment(inspect('kohl-cutover-preview-auth'))['GOTRUE_API_PORT']
auth=gateway
app='http://127.0.0.1:39041'
for _ in range(30):
    try:
        urllib.request.urlopen(app+'/login', timeout=2); break
    except Exception: time.sleep(1)
assert urlparse(environment(inspect('kohl-cutover-preview-auth'))['GOTRUE_DB_DATABASE_URL']).path.lstrip('/') == database
executive_email=str(uuid.uuid4())+'@test.invalid'; executive_password=str(uuid.uuid4())+'!Aa'
status,identity=call(auth,'/admin/users',service,payload={'email':executive_email,'password':executive_password,'email_confirm':True})
assert status in (200,201), 'Isolated executive fixture creation failed: HTTP '+str(status)
executive_id=identity['id']
sql(database,"insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values ('"+executive_id+"','Isolated password admin','0500000000','ADMIN',true)")
status,session=call(auth,'/token?grant_type=password',key,payload={'email':executive_email,'password':executive_password})
assert status==200, 'Isolated executive login failed'
token=session['access_token']
status,listing=call(app,'/api/access/users',key,token)
assert status==200, 'Isolated executive listing failed'
properties=listing['properties']
leases=[c for c in listing['contracts'] if c['status'].lower() in ['active','ساري'] and c['start_date'] <= '2026-10-04' <= c['end_date']]
assert properties and leases, 'Isolated linked-record fixtures required'
created=[executive_id]
try:
    for role,links in [
        ('OWNER',{'owners':[{'property_id':properties[0]['id'],'ownership_share':0.0001}]}),
        ('TENANT',{'leases':[leases[0]['id']]}),
        ('BROKER',{'agreement':{'agreement_number':str(uuid.uuid4()),'commission_type':'FIXED','commission_value':100,'percentage_basis':None}}),
    ]:
        email=str(uuid.uuid4())+'@test.invalid'; password=str(uuid.uuid4())+'!Aa'
        payload={'email':email,'full_name':'Isolated password '+role,'mobile':'0500000000','role':role,'password':password,**links}
        status,result=call(app,'/api/access/users',key,token,payload)
        assert status==200 and result['saved'] and not result['invitation_sent'], role+' creation failed'
        uid=result['user_id']; created.append(uid)
        assert password not in json.dumps(result), 'Password leaked in response'
        status,session=call(auth,'/token?grant_type=password',key,payload={'email':email,'password':password})
        assert status==200, role+' password login failed'
        external=session['access_token']
        status,profile=call(app,'/api/portal/me',key,external)
        assert status==200 and profile['account']['role']==role, role+' private profile failed'
        assert call(app,'/api/access/users',key,external)[0]==403, role+' administration isolation failed'
        assert call(app,'/api/access/users',key,external,payload)[0]==403, role+' creation denial failed'
        assert call(app,'/api/access/users/'+uid,key,token,{'action':'deactivate'})[0]==200
        assert call(app,'/api/portal/me',key,external)[0]==403, 'Deactivation failed'
        assert password not in sql(database,"select coalesce(string_agg(changes::text, ''),'') from portal_private.access_audit where target_user_id='"+uid+"'"), 'Password entered audit history'
        print(role+': created, password login, private role, denied administration, deactivation and audit privacy passed',flush=True)
finally:
    for uid in reversed(created):
        # The private schema deliberately restricts Auth deletions; remove only these fake fixtures.
        sql(database,"begin; delete from portal_private.owner_property_links where owner_user_id='"+uid+"'; delete from portal_private.tenant_lease_links where tenant_user_id='"+uid+"'; delete from portal_private.broker_contract_links where broker_user_id='"+uid+"'; delete from portal_private.broker_office_agreements where broker_user_id='"+uid+"'; delete from portal_private.access_audit where actor_user_id='"+uid+"' or target_user_id='"+uid+"'; delete from portal_private.accounts where user_id='"+uid+"'; commit;")
        assert call(auth,'/admin/users/'+uid,service,method='DELETE')[0] in (200,204)

# Only login and GET requests against production. No bootstrap/provision operation.
live=environment(inspect('kohl_crm_app')); public=live['NEXT_PUBLIC_SUPABASE_ANON_KEY']
users=json.loads(pathlib.Path('/home/debian/.config/kohl/executive-accounts.json').read_text())
for user in users:
    status,session=call('https://kohl.kohlestate-ksa.online','/auth/v1/token?grant_type=password',public,payload={'email':user['email'],'password':user['password']})
    assert status==200, 'Live executive login failed: HTTP '+str(status)+' '+str(session.get('error_code', session.get('msg', '')))
    status,profile=call('https://app.kohlestate-ksa.online','/api/portal/me',public,session['access_token'])
    assert status==200 and profile['account']['role']==user['role']
    assert call('https://app.kohlestate-ksa.online','/api/access/users',public,session['access_token'])[0]==200
    print(user['role']+': live password login and user-management access verified',flush=True)
print('Isolated release acceptance passed; production records unchanged')
