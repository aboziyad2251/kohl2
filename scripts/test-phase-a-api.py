"""Run on VPS against an isolated schema clone, never the production database.
Starts a loopback-only PostgREST container using the installed image, with a
separate JWT secret. Sends direct REST/RPC requests for two users of each role.
No real invites, production identities or application records are created.
"""
import base64, hashlib, hmac, json, os, subprocess, tempfile, time, urllib.request, urllib.error, uuid
from urllib.parse import urlsplit, urlunsplit

DB = os.environ.get('PORTAL_TEST_DB', 'kohl_portal_phasea_test2')
assert DB.startswith('kohl_portal_phasea_test') and DB != 'postgres'
SECRET = 'isolated-phase-a-api-test-secret-not-a-production-key-2026'
NAME = 'kohl-portal-phasea-rest-test'
PORT = 39021
checks = 0
def check(value, label):
    global checks
    assert value, label
    checks += 1
    print('PASS', label, flush=True)
def sql(query):
    p = subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB],input=query,text=True,capture_output=True)
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout
def uid(n): return f'10000000-0000-4000-8000-{n:012d}'
def jwt(n=None, role='authenticated', meta=None):
    def enc(value): return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=').decode()
    payload = {'role':role,'exp':int(time.time())+600,'iat':int(time.time()),'aud':'authenticated'}
    if n: payload['sub'] = uid(n)
    if meta: payload['user_metadata'] = meta
    body = enc({'alg':'HS256','typ':'JWT'})+'.'+enc(payload)
    return body+'.'+base64.urlsafe_b64encode(hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
def api(path, n=None, method='GET', payload=None, role='authenticated', meta=None):
    headers={'Content-Type':'application/json','Authorization':'Bearer '+jwt(n,role,meta)}
    if method in ('POST','PATCH'): headers['Prefer']='return=representation'
    req=urllib.request.Request(f'http://127.0.0.1:{PORT}/'+path,headers=headers,method=method,
        data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=10) as response:
            raw=response.read(); return response.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw=e.read(); return e.code,json.loads(raw) if raw else None
def admin(operation,payload):
    return api('rpc/portal_admin',method='POST',role='service_role',payload={'actor':uid(1),'operation':operation,'payload':payload,'request_id':str(uuid.uuid4())})

sql("update public.contracts set end_date='2099-12-31',status='active' where contract_number like 'FIXTURE-%'; update portal_private.settings set tenant_lease_end_action='HISTORY' where singleton; update portal_private.accounts set is_active=true where user_id='"+uid(3)+"';")

installed=json.loads(subprocess.check_output(['docker','inspect','supabase-rest'],text=True))[0]
env=dict(item.split('=',1) for item in installed['Config']['Env'])
uri=urlsplit(env['PGRST_DB_URI'])
test_uri=urlunsplit((uri.scheme,uri.netloc,'/'+DB,uri.query,uri.fragment))
network=next(iter(installed['NetworkSettings']['Networks']))
fd,envfile=tempfile.mkstemp(prefix='kohl-portal-test-',suffix='.env');os.chmod(envfile,0o600)
try:
    with os.fdopen(fd,'w') as f:
        f.write('PGRST_DB_URI='+test_uri+'\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET='+SECRET+'\n')
    subprocess.run(['docker','run','-d','--name',NAME,'--network',network,'-p',f'127.0.0.1:{PORT}:3000','--env-file',envfile,installed['Config']['Image']],check=True,capture_output=True)
    for attempt in range(20):
        try:
            status,_=api('',role='anon')
            if status==200: break
        except OSError: pass
        time.sleep(.25)
    for n in range(3,9):
        status,body=api('rpc/portal_me',n,'POST',{})
        check(status==200 and body['account']['id']==uid(n),f'user {n} reads own profile')
        expected_property=f'30000000-0000-4000-8000-{(1 if n%2 else 2):012d}'
        expected_contract=f'40000000-0000-4000-8000-{(1 if n%2 else 2):012d}'
        if n in (3,4): check([x['property_id'] for x in body['owners']]==[expected_property],f'owner {n} cannot read other owner links')
        if n in (5,6): check([x['contract_id'] for x in body['leases']]==[expected_contract],f'tenant {n} cannot read other tenant links')
        if n in (7,8): check([x['contract_id'] for x in body['broker_contracts']]==[expected_contract],f'broker {n} cannot read other broker links')
        check('PRIVATE NOTE' not in json.dumps(body),f'user {n} private columns absent')
        for table in ('contracts','properties','financial_transactions','employees','tenants','property_maintenance_tasks'):
            status,rows=api(table+'?select=*',n)
            check(status in (401,403) or (status==200 and rows==[]),f'user {n} raw {table} denied')
        status,_=api('rpc/portal_admin',n,'POST',{'actor':uid(1),'operation':'LIST','payload':{},'request_id':str(uuid.uuid4())})
        check(status in (401,403,404),f'user {n} cannot call admin RPC with spoofed actor')
        status,_=api('accounts',n,'PATCH',{'role':'ADMIN'})
        check(status in (401,403,404),f'user {n} role table inaccessible')
    status,body=api('rpc/portal_me',3,'POST',{},meta={'role':'ADMIN'})
    check(status==200 and body['account']['role']=='OWNER','editable JWT metadata cannot elevate role')
    for table in ('contracts','properties','financial_transactions','employees'):
        status,_=api(table,role='anon');check(status in (401,403),f'anon {table} denied')
    status,_=api('rpc/portal_me',method='POST',payload={},role='anon');check(status in (401,403,404),'anon profile denied')
    for n in (1,2):
        status,rows=api('contracts?select=id',n);check(status==200 and len(rows)==2,f'executive {n} sees all contracts')
        prop={'property_name':f'Executive CRUD {n}','property_type':'Residential','address':'Fixture','city':'Riyadh','lessor_id':'20000000-0000-4000-8000-000000000001'}
        status,rows=api('properties',n,'POST',prop);check(status==201,f'executive {n} can insert')
        record=rows[0]['id'];status,_=api('properties?id=eq.'+record,n,'PATCH',{'property_name':'Updated fixture'});check(status==200,f'executive {n} can update')
        status,_=api('properties?id=eq.'+record,n,'DELETE');check(status in (200,204),f'executive {n} can delete')
    status,_=admin('SAVE',{'user_id':uid(6),'full_name':'Tenant 2 edited','email':'tenant2@test.invalid','mobile':'0500000000','role':'TENANT','leases':['40000000-0000-4000-8000-000000000002']})
    check(status==200,'executive edits tenant links atomically')
    status,body=api('rpc/portal_me',6,'POST',{})
    check(status==200 and body['account']['name']=='Tenant 2 edited' and len(body['leases'])==1,'tenant receives updated account and links')
    status,_=admin('SAVE',{'user_id':uid(4),'full_name':'Owner 2 edited','email':'owner2@test.invalid','mobile':'0500000000','role':'OWNER','owners':[{'property_id':'30000000-0000-4000-8000-000000000002','ownership_share':100}]})
    check(status==200,'executive edits owner links and preserves historical share periods')
    status,_=admin('SAVE',{'user_id':uid(7),'full_name':'Broker 1 edited','email':'broker1@test.invalid','mobile':'0500000000','role':'BROKER','agreement_id':'60000000-0000-4000-8000-000000000001','broker_contracts':['40000000-0000-4000-8000-000000000001']})
    check(status==200,'executive edits broker contract links')
    status,_=admin('SAVE',{'user_id':uid(7),'full_name':'Broker','mobile':'0500000000','role':'BROKER','agreement_id':'60000000-0000-4000-8000-000000000002','broker_contracts':[]})
    check(status==400,'broker cannot be linked to another broker agreement')
    status,_=admin('SAVE',{'user_id':uid(6),'full_name':'Tenant','mobile':'0500000000','role':'ADMIN'})
    check(status==400,'external creation cannot grant an executive role')
    status,rows=api('employees?select=id',9);check(status==200 and len(rows)==1,'HR keeps employee access')
    status,rows=api('contracts?select=id',10);check(status==200 and len(rows)==1,'employee sees only assigned contracts')
    status,_=api('contracts?id=eq.40000000-0000-4000-8000-000000000001',10,'PATCH',{'assigned_agent_id':None});check(status in (401,403),'employee cannot reassign their contract')
    status,_=admin('STATUS',{'user_id':uid(3),'is_active':False});check(status==200,'executive deactivates owner')
    status,_=api('rpc/portal_me',3,'POST',{});check(status in (401,403),'existing owner JWT denied immediately after deactivation')
    status,_=admin('STATUS',{'user_id':uid(3),'is_active':True});check(status==200,'executive reactivates owner')
    sql("update public.contracts set end_date='2026-01-02',status='expired' where contract_number='FIXTURE-1';")
    status,body=api('rpc/portal_me',5,'POST',{});check(status==200 and body['account']['history_only'],'expired tenant gets history only')
    status,_=admin('SETTINGS',{'tenant_lease_end_action':'DEACTIVATE'});check(status==200,'executive changes expiry setting')
    status,_=api('rpc/portal_me',5,'POST',{});check(status in (401,403),'expired tenant denied under DEACTIVATE setting')
    status,_=admin('SETTINGS',{'tenant_lease_end_action':'HISTORY'});check(status==200,'expiry setting restored')
    status,body=admin('LIST',{});check(status==200 and len(body['audit'])>=4 and body['audit'][0]['actor_user_id']==uid(1),'administration changes have attributed audit entries')
    status,_=api('rpc/portal_admin',method='POST',role='service_role',payload={'actor':uid(7),'operation':'LIST','payload':{},'request_id':str(uuid.uuid4())});check(status in (401,403),'DB independently rejects nonexecutive actor')
    try:
        sql("insert into portal_private.owner_property_links(owner_user_id,property_id,ownership_share,effective_from) values ('"+uid(4)+"','30000000-0000-4000-8000-000000000001',1,'2026-01-01');")
        check(False,'overlapping ownership rejected')
    except RuntimeError as e: check('Ownership exceeds' in str(e),'overlapping ownership exceeds 100 percent rejected')
    try:
        sql("insert into portal_private.tenant_lease_links values ('"+uid(7)+"','40000000-0000-4000-8000-000000000001',now());")
        check(False,'wrong role assignment rejected')
    except RuntimeError as e: check('Tenant role required' in str(e),'wrong-role assignment rejected at database level')
    print(f'{checks} checks passed against isolated PostgREST API.',flush=True)
finally:
    subprocess.run(['docker','rm','-f',NAME],capture_output=True)
    os.unlink(envfile)
