"""Trusted VPS operator only. Provision and verify approved password executives.

Private input and credentials stay outside the checkout. Never sends mail.
Run with --provision only after the coordinated Auth/database cutover.
"""
import argparse,json,pathlib,re,subprocess,urllib.request,urllib.error,uuid

p=argparse.ArgumentParser()
p.add_argument('--users',required=True);p.add_argument('--env',required=True)
p.add_argument('--database',required=True);p.add_argument('--gateway',required=True)
p.add_argument('--app',required=True);p.add_argument('--provision',action='store_true')
args=p.parse_args()
assert args.database=='postgres' or re.fullmatch(r'kohl_cutover_[a-z0-9]+',args.database)
config=dict(line.split('=',1) for line in pathlib.Path(args.env).read_text().splitlines() if '=' in line and not line.startswith('#'))
anon=config['NEXT_PUBLIC_SUPABASE_ANON_KEY'];service=config['SUPABASE_SERVICE_ROLE_KEY']
users=json.loads(pathlib.Path(args.users).read_text())
assert len(users)==2 and {u['role'] for u in users}=={'ADMIN','CEO'}
assert len({u['email'].lower() for u in users})==2
for u in users:
    assert len(u['password'])>=12 and re.fullmatch(r'05\d{8}',u['mobile'])
def api(base,path,token,payload=None,method=None):
    req=urllib.request.Request(base+path,data=json.dumps(payload).encode() if payload is not None else None,method=method,headers={'Content-Type':'application/json','apikey':anon,'Authorization':'Bearer '+token})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            raw=response.read();return response.status,json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:return error.code,None
def sql(query):
    result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin','-d',args.database,'-v','ON_ERROR_STOP=1'],input=query,text=True,capture_output=True)
    if result.returncode:raise RuntimeError('Private account mapping failed; no role was granted')
quote=lambda value:"'"+str(value).replace("'","''")+"'"
for user in users:
    if args.provision:
        status,identity=api(args.gateway,'/auth/v1/admin/users',service,{'email':user['email'],'password':user['password'],'email_confirm':True,'user_metadata':{'full_name':user['full_name']}})
        if status not in (200,201):raise RuntimeError('Identity provisioning failed; do not retry without checking existing identities')
        uid=identity['id'];request=str(uuid.uuid4())
        sql("begin; insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values ("+','.join(quote(x) for x in [uid,user['full_name'],user['mobile'],user['role']])+",true); insert into portal_private.access_audit(target_user_id,action,changes,request_id) values("+quote(uid)+",'OPERATOR_BOOTSTRAP',jsonb_build_object('role',"+quote(user['role'])+",'source','verified private operator file'),"+quote(request)+"); commit;")
    status,session=api(args.gateway,'/auth/v1/token?grant_type=password',anon,{'email':user['email'],'password':user['password']})
    assert status==200 and session.get('access_token'),'Executive password login failed'
    token=session['access_token']
    status,profile=api(args.app,'/api/portal/me',token)
    assert status==200 and profile['account']['role']==user['role'],'Executive private role verification failed'
    status,listing=api(args.app,'/api/access/users',token)
    assert status==200 and isinstance(listing.get('users'),list),'Executive user administration unavailable'
    status,properties=api(args.gateway,'/rest/v1/properties?select=id',token)
    assert status==200 and len(properties)==6,'Executive property visibility differs from import'
    status,brokerage=api(args.gateway,'/rest/v1/brokerage_agreements?select=id',token)
    assert status==200 and len(brokerage)==6,'Executive brokerage visibility differs from import'
    print(user['role']+': password login, private role, user administration and imported records verified',flush=True)
print('Both approved executives verified')
