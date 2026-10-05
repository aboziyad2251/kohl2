"""Real Auth/Next/RLS acceptance in the existing isolated database only.

Creates fake Admin/CEO/employee fixtures and removes them in finally. Never uses
saved real passwords, provisions production users, or prints tokens/secrets.
"""
import base64, hashlib, hmac, json, pathlib, subprocess, time, urllib.error, urllib.request, uuid
from urllib.parse import urlparse

STAGE=pathlib.Path('/home/debian/projects/kohl-employee-release')
IMAGE='kohl-employees:20261004'
CONTAINER='kohl-employee-preview'
APP='http://127.0.0.1:39042'

def inspect(name):
    return json.loads(subprocess.check_output(['docker','inspect',name]))[0]

def environment(container):
    return dict(x.split('=',1) for x in container['Config']['Env'] if '=' in x)

rest=inspect('kohl-cutover-preview-rest')
database=urlparse(environment(rest)['PGRST_DB_URI']).path.lstrip('/')
auth_env=environment(inspect('kohl-cutover-preview-auth'))
assert database.startswith('kohl_cutover_') and database!='postgres'
assert urlparse(auth_env['GOTRUE_DB_DATABASE_URL']).path.lstrip('/')==database
assert auth_env['GOTRUE_JWT_SECRET']==environment(rest)['PGRST_JWT_SECRET']

def sql(query):
    assert database.startswith('kohl_cutover_') and database!='postgres'
    return subprocess.check_output(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin',
        '-d',database,'-At','-v','ON_ERROR_STOP=1'],input=query.encode()).decode().strip()

def call(base,path,key,token=None,payload=None,method=None):
    req=urllib.request.Request(base+path,data=json.dumps(payload).encode() if payload is not None else None,
        method=method,headers={'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+(token or key)})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            raw=response.read(); return response.status,json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        try: body=json.loads(error.read())
        except Exception: body={}
        return error.code,body

def jwt(role):
    encode=lambda value: base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=')
    body=encode({'alg':'HS256','typ':'JWT'})+b'.'+encode({'role':role,'aud':'authenticated','exp':int(time.time())+3600})
    return (body+b'.'+base64.urlsafe_b64encode(hmac.new(auth_env['GOTRUE_JWT_SECRET'].encode(),body,hashlib.sha256).digest()).rstrip(b'=')).decode()

key=jwt('anon'); service=jwt('service_role')
auth='http://127.0.0.1:'+auth_env['GOTRUE_API_PORT']
rest_port=next(iter(rest['NetworkSettings']['Ports']['3000/tcp']))['HostPort'] if rest['NetworkSettings']['Ports'].get('3000/tcp') else None
rest_url='http://127.0.0.1:'+(rest_port or environment(rest)['PGRST_SERVER_PORT'])
original=sql("select pg_get_functiondef('public.portal_admin(uuid,text,jsonb,uuid)'::regprocedure)")
migration=(STAGE/'supabase/migrations/20261004131256_employee_login_accounts.sql').read_text()
sql('begin;\n'+migration+'\ncommit;')
env=environment(inspect('kohl-cutover-preview-app'))
env['NEXT_PUBLIC_SUPABASE_ANON_KEY']=key; env['SUPABASE_SERVICE_ROLE_KEY']=service
assert next(iter(inspect('kohl-cutover-preview-app')['NetworkSettings']['Networks']))=='host'
command=['docker','run','-d','--name',CONTAINER,'--network','host','-e','PORT=39042','-e','HOSTNAME=127.0.0.1']
for name,value in env.items():
    if name in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVER_URL','SUPABASE_SERVICE_ROLE_KEY','APP_ORIGIN','GOOGLE_LOGIN_ENABLED']:
        command+=['-e',name+'='+value]
command+=[IMAGE]
created=[]; employees=[]; sessions={}; passwords=[]

def login(email,password):
    status,session=call(auth,'/token?grant_type=password',key,payload={'email':email,'password':password})
    assert status==200, 'Isolated login failed'
    return session['access_token']

def employee_fixture(status='ACTIVE'):
    eid=str(uuid.uuid4()); employees.append(eid)
    sql("insert into public.employees(id,employee_number,name,national_id_or_iqama,job_title,department,phone,email,status,system_role) values ('"+eid+"','TEST-"+eid+"','Isolated employee','0000000000','Tester','Test','0500000000','fake@test.invalid','"+status+"','EMPLOYEE')")
    return eid

def payload(role,links):
    password=str(uuid.uuid4())+'!Aa'; passwords.append(password)
    return {'email':str(uuid.uuid4())+'@test.invalid','full_name':'Isolated '+role,'mobile':'0500000000','role':role,'password':password,**links}

try:
    subprocess.run(command,check=True,stdout=subprocess.DEVNULL)
    for _ in range(30):
        try:
            if urllib.request.urlopen(APP+'/login',timeout=2).status==200: break
        except Exception: pass
        time.sleep(1)
    else: raise AssertionError('Isolated app did not start')
    for role in ['ADMIN','CEO']:
        email=str(uuid.uuid4())+'@test.invalid'; password=str(uuid.uuid4())+'!Aa'
        status,identity=call(auth,'/admin/users',service,payload={'email':email,'password':password,'email_confirm':True})
        assert status in (200,201)
        uid=identity['id']; created.append(uid)
        sql("insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values ('"+uid+"','Isolated executive','0500000000','"+role+"',true)")
        sessions[role]=login(email,password)
    token=sessions['ADMIN']
    status,listing=call(APP,'/api/access/users',key,token)
    assert status==200 and 'employees' in listing
    leases=[c for c in listing['contracts'] if c['status'].lower() in ['active','ساري'] and c['start_date']<=time.strftime('%Y-%m-%d')<=c['end_date']]
    assert listing['properties'] and leases
    eid=employee_fixture(); second=employee_fixture(); inactive=employee_fixture('TERMINATED')
    cases=[('ADMIN','EMPLOYEE',{'employee_id':eid}),('CEO','EMPLOYEE',{'employee_id':second}),
        ('ADMIN','OWNER',{'owners':[{'property_id':listing['properties'][0]['id'],'ownership_share':0.0001}]}),
        ('ADMIN','TENANT',{'leases':[leases[0]['id']]}),
        ('ADMIN','BROKER',{'agreement':{'agreement_number':str(uuid.uuid4()),'commission_type':'FIXED','commission_value':100,'percentage_basis':None}})]
    for creator,role,links in cases:
        data=payload(role,links)
        status,result=call(APP,'/api/access/users',key,sessions[creator],data)
        if status!=200:
            print('Creation returned HTTP '+str(status)+' '+str(result.get('error','')),flush=True)
            print(subprocess.check_output(['docker','logs','--tail','8',CONTAINER],stderr=subprocess.STDOUT).decode(),flush=True)
            # Direct isolated RPC reveals the DB cause, using a fresh fake identity.
            st,identity=call(auth,'/admin/users',service,payload={'email':str(uuid.uuid4())+'@test.invalid','password':str(uuid.uuid4())+'!Aa','email_confirm':True})
            assert st in (200,201)
            test_id=identity['id']; created.append(test_id)
            safe={k:v for k,v in data.items() if k!='password'}; safe['user_id']=test_id
            st,problem=call(rest_url,'/rpc/portal_admin',service,payload={'actor':created[0],'operation':'SAVE','payload':safe,'request_id':str(uuid.uuid4())})
            print('Isolated DB diagnostic: '+str(problem.get('code',''))+' '+str(problem.get('message','')),flush=True)
        assert status==200 and result.get('saved'), creator+' '+role+' creation failed'
        uid=result['user_id']; created.append(uid)
        assert data['password'] not in json.dumps(result)
        session=login(data['email'],data['password'])
        status,profile=call(APP,'/api/portal/me',key,session)
        assert status==200 and profile['account']['role']==role
        if role=='EMPLOYEE':
            assert profile['account']['employee_id']==links['employee_id']
            if rest_url:
                status,rows=call(rest_url,'/employees?select=id',key,session)
                assert status==200 and [r['id'] for r in rows]==[links['employee_id']], 'Employee HR isolation failed'
            assert call(APP,'/api/access/users',key,session,data)[0]==403
            forged={**data,'user_id':uid,'role':'ADMIN'}; forged.pop('password')
            assert call(APP,'/api/access/users',key,token,forged)[0]==400
        assert call(APP,'/api/access/users',key,session)[0]==403
        assert call(APP,'/api/access/users/'+uid,key,token,{'action':'deactivate'})[0]==200
        assert call(APP,'/api/portal/me',key,session)[0]==403
        assert data['password'] not in sql("select coalesce(string_agg(changes::text,''),'') from portal_private.access_audit where target_user_id='"+uid+"'")
        print(creator+' creates '+role+': login, private role, denied administration, deactivation and password privacy passed',flush=True)
    for link in [eid,inactive,str(uuid.uuid4())]:
        data=payload('EMPLOYEE',{'employee_id':link})
        assert call(APP,'/api/access/users',key,token,data)[0]==400, 'Invalid employee link accepted'
        assert sql("select count(*) from auth.users where email='"+data['email']+"'")=='0', 'Failed creation leaked Auth identity'
    assert call(APP,'/api/access/users',key)[0]==401
    assert sql("select has_function_privilege('anon','public.portal_admin(uuid,text,jsonb,uuid)','execute') or has_function_privilege('authenticated','public.portal_admin(uuid,text,jsonb,uuid)','execute')")=='f'
    assert sql("select proconfig::text from pg_proc where oid='public.portal_admin(uuid,text,jsonb,uuid)'::regprocedure").find('search_path')>=0
    print('Invalid, duplicate and terminated employee links rejected; failed identities cleaned; database RPC stays server-only',flush=True)
    (STAGE/'employee-acceptance.json').write_text(json.dumps({'passed':True,'image':IMAGE,'database':database,'creators':['ADMIN','CEO'],'roles':['EMPLOYEE','OWNER','TENANT','BROKER']}))
finally:
    for uid in reversed(created):
        sql("begin; delete from portal_private.owner_property_links where owner_user_id='"+uid+"'; delete from portal_private.tenant_lease_links where tenant_user_id='"+uid+"'; delete from portal_private.broker_contract_links where broker_user_id='"+uid+"'; delete from portal_private.broker_office_agreements where broker_user_id='"+uid+"'; delete from portal_private.access_audit where actor_user_id='"+uid+"' or target_user_id='"+uid+"'; delete from portal_private.accounts where user_id='"+uid+"'; commit;")
        assert call(auth,'/admin/users/'+uid,service,method='DELETE')[0] in (200,204)
    for eid in employees: sql("delete from public.employees where id='"+eid+"'")
    subprocess.run(['docker','rm','-f',CONTAINER],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    sql('begin;\n'+original+';\ncommit;')
