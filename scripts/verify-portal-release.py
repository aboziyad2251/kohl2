"""End-to-end portal acceptance with isolated Auth, REST, Storage and PostgreSQL.

No real passwords are used. Test photos/PDFs contain fake records only. The
isolated services and test DB remain available for visual QA until cleanup.
"""
import base64, hashlib, hmac, http.server, json, os, pathlib, socketserver, subprocess, threading, time, urllib.error, urllib.request, uuid
from urllib.parse import urlparse, urlsplit, urlunsplit
os.umask(0o077)
STAGE=pathlib.Path('/home/debian/projects/kohl-portals-release')
PRIVATE=STAGE/'.portal-stage'; PRIVATE.mkdir(mode=0o700,exist_ok=True)
DB='kohl_cutover_portals_20261005'; APP='http://127.0.0.1:39050'; GATEWAY='http://127.0.0.1:39053'; IMAGE='kohl-portals:20261005'
NAMES=['kohl-portals-test-auth','kohl-portals-test-rest','kohl-portals-test-storage','kohl-portals-test-app']
def inspect(name): return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
def environment(container): return dict(x.split('=',1) for x in container['Config']['Env'] if '=' in x)
def sql(query,db=DB):
 assert db.startswith('kohl_cutover_') and db!='postgres'
 result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin','-d',db,'-At','-v','ON_ERROR_STOP=1'],input=query.encode(),capture_output=True)
 if result.returncode: raise RuntimeError(result.stderr.decode())
 return result.stdout.decode().strip()
def key(role):
 encode=lambda x:base64.urlsafe_b64encode(json.dumps(x,separators=(',',':')).encode()).rstrip(b'=')
 body=encode({'alg':'HS256','typ':'JWT'})+b'.'+encode({'role':role,'aud':'authenticated','exp':int(time.time())+86400})
 return (body+b'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),body,hashlib.sha256).digest()).rstrip(b'=')).decode()
def call(base,path,token=None,payload=None,method=None,binary=False):
 headers={'Content-Type':'application/json','apikey':anon,'Authorization':'Bearer '+(token or anon)}
 req=urllib.request.Request(base+path,data=json.dumps(payload).encode() if payload is not None else None,method=method,headers=headers)
 try:
  with urllib.request.urlopen(req,timeout=60) as r:
   body=r.read(); return r.status,body if binary else json.loads(body) if body else {}
 except urllib.error.HTTPError as e:
  try: body=json.loads(e.read())
  except Exception: body={}
  return e.code,body
def replace_db(uri):
 u=urlsplit(uri); return urlunsplit((u.scheme,u.netloc.replace(u.hostname,address),'/'+DB,u.query,u.fragment))
def start(name,image,env,mount=None):
 command=['docker','run','-d','--name',name,'--network','host']
 if mount: command+=['-v',mount]
 for k,v in env.items(): command+=['-e',k+'='+v]
 command+=[image]
 subprocess.run(command,check=True,stdout=subprocess.DEVNULL)
def wait(url):
 for _ in range(60):
  try:
   urllib.request.urlopen(url,timeout=2); return
  except Exception: time.sleep(1)
 raise AssertionError('Isolated service did not become ready')
socketserver.ThreadingTCPServer.allow_reuse_address=True
class Gateway(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args): pass
 def route(self):
  routes={'/auth/v1/':39052,'/rest/v1/':39051,'/storage/v1/':39054}
  prefix=next((p for p in routes if self.path.startswith(p)),None)
  if not prefix: self.send_error(404); return
  body=self.rfile.read(int(self.headers.get('Content-Length',0))) if self.command not in ('GET','DELETE') else None
  headers={k:v for k,v in self.headers.items() if k.lower() not in ('host','connection','origin','content-length')}
  request=urllib.request.Request('http://127.0.0.1:'+str(routes[prefix])+'/'+self.path[len(prefix):],data=body,method=self.command,headers=headers)
  try: response=urllib.request.urlopen(request,timeout=30)
  except urllib.error.HTTPError as e: response=e
  content=response.read(); self.send_response(response.status)
  for k,v in response.headers.items():
   if k.lower() not in ('connection','transfer-encoding','content-length'): self.send_header(k,v)
  self.send_header('Content-Length',str(len(content))); self.end_headers(); self.wfile.write(content)
 do_GET=route; do_POST=route; do_PUT=route; do_PATCH=route; do_DELETE=route

rest=inspect('kohl-cutover-preview-rest'); source=urlparse(environment(rest)['PGRST_DB_URI']).path.lstrip('/')
assert source.startswith('kohl_cutover_') and source!=DB
address=inspect('supabase-db')['NetworkSettings']['Networks']['supabase_default']['IPAddress']
secret=environment(inspect('kohl-cutover-preview-auth'))['GOTRUE_JWT_SECRET']; anon=key('anon'); service=key('service_role')
# Refuse a rerun that might overwrite retained QA work.
existing=subprocess.check_output(['docker','exec','supabase-db','psql','-X','-U','supabase_admin','-d','postgres','-At','-c',"select count(*) from pg_database where datname='"+DB+"'"]).decode().strip()
assert existing=='0', 'Isolated QA database already exists; inspect before rerunning'
dump=subprocess.check_output(['docker','exec','supabase-db','pg_dump','-U','supabase_admin','-d',source,'-Fc'])
subprocess.run(['docker','exec','supabase-db','createdb','-U','supabase_admin',DB],check=True)
result=subprocess.run(['docker','exec','-i','supabase-db','pg_restore','-U','supabase_admin','-d',DB],input=dump,capture_output=True)
if result.returncode: (PRIVATE/'restore.log').write_bytes(result.stderr); raise AssertionError('Isolated restore failed')
sql((STAGE/'supabase/migrations/20261004131256_employee_login_accounts.sql').read_text())
sql((STAGE/'supabase/migrations/20261005161549_role_portal_workflows.sql').read_text())
gateway=socketserver.ThreadingTCPServer(('127.0.0.1',39053),Gateway)
threading.Thread(target=gateway.serve_forever,daemon=True).start()
original_auth=inspect('kohl-cutover-preview-auth'); authenv=environment(original_auth)
authenv.update({'GOTRUE_DB_DATABASE_URL':replace_db(authenv['GOTRUE_DB_DATABASE_URL']),'GOTRUE_API_PORT':'39052','API_PORT':'39052','GOTRUE_API_HOST':'127.0.0.1','API_HOST':'127.0.0.1','API_EXTERNAL_URL':GATEWAY+'/auth/v1','GOTRUE_SITE_URL':APP,'GOTRUE_DISABLE_SIGNUP':'true'})
start(NAMES[0],original_auth['Config']['Image'],authenv)
restenv=environment(rest); restenv.update({'PGRST_DB_URI':replace_db(restenv['PGRST_DB_URI']),'PGRST_SERVER_PORT':'39051','PGRST_SERVER_HOST':'127.0.0.1'})
start(NAMES[1],rest['Config']['Image'],restenv)
storage=inspect('supabase-storage'); storageenv=environment(storage)
storageenv.update({'DATABASE_URL':replace_db(storageenv['DATABASE_URL']),'POSTGREST_URL':'http://127.0.0.1:39051','AUTH_JWT_SECRET':secret,'ANON_KEY':anon,'SERVICE_KEY':service,'PORT':'39054','HOST':'127.0.0.1','STORAGE_PUBLIC_URL':GATEWAY+'/storage/v1','ENABLE_IMAGE_TRANSFORMATION':'false','S3_PROTOCOL_ACCESS_KEY_ID':'isolated-test','S3_PROTOCOL_ACCESS_KEY_SECRET':str(uuid.uuid4())})
(PRIVATE/'storage').mkdir(mode=0o700,exist_ok=True)
start(NAMES[2],storage['Config']['Image'],storageenv,str(PRIVATE/'storage')+':/var/lib/storage')
appenv=environment(inspect('kohl_crm_app')); appenv.update({'SUPABASE_SERVER_URL':GATEWAY,'NEXT_PUBLIC_SUPABASE_ANON_KEY':anon,'SUPABASE_SERVICE_ROLE_KEY':service,'PORT':'39050','HOSTNAME':'127.0.0.1','APP_ORIGIN':APP})
start(NAMES[3],IMAGE,appenv)
wait('http://127.0.0.1:39052/health'); wait(APP+'/login'); wait('http://127.0.0.1:39054/status')
sessions={}; users={}
for role in ['ADMIN','CEO','TENANT_A','TENANT_B','OWNER_A','OWNER_B','BROKER_A','BROKER_B']:
 email=str(uuid.uuid4())+'@test.invalid'; password=str(uuid.uuid4())+'!Aa'
 status,identity=call('http://127.0.0.1:39052','/admin/users',service,{'email':email,'password':password,'email_confirm':True})
 assert status in (200,201)
 uid=identity['id']; users[role]=uid
 sql("insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values ('"+uid+"','اختبار بوابة كحل','0500000000','"+role.split('_')[0]+"',true)")
 status,session=call('http://127.0.0.1:39052','/token?grant_type=password',anon,{'email':email,'password':password})
 assert status==200; sessions[role]=session
props=[]; contracts=[]
for letter in ['A','B']:
 property_id=str(uuid.uuid4()); contract_id=str(uuid.uuid4()); props.append(property_id); contracts.append(contract_id)
 lessor=sql('select id from public.lessors limit 1')
 sql("insert into public.properties(id,property_name,property_type,address,city,lessor_id) values ('"+property_id+"','عقار الاختبار "+letter+"','Residential','شارع الاختبار','الرياض','"+lessor+"'); insert into public.contracts(id,contract_number,type,property_id,lessor_id,tenant_name,tenant_national_id,rent_amount,payment_schedule,start_date,end_date,status,unit_label,unit_details) values ('"+contract_id+"','PORTAL-"+letter+"','RESIDENTIAL','"+property_id+"','"+lessor+"','مستأجر الاختبار','0000000000',12000,'Monthly','2026-01-01','2026-12-31','active','شقة "+letter+"','غرفتان وصالة'); insert into portal_private.tenant_lease_links values ('"+users['TENANT_'+letter]+"','"+contract_id+"',now()); insert into portal_private.owner_property_links(owner_user_id,property_id,ownership_share,effective_from) values ('"+users['OWNER_'+letter]+"','"+property_id+"',100,'2026-01-01');")
 agreement=sql("insert into portal_private.broker_office_agreements(broker_user_id,agreement_number,commission_type,commission_value,percentage_basis,effective_from) values ('"+users['BROKER_'+letter]+"','PORTAL-"+letter+"','PERCENTAGE',5,'DEAL_VALUE','2026-01-01') returning id") .splitlines()[0]
 sql("insert into portal_private.broker_contract_links(broker_user_id,contract_id,agreement_id) values ('"+users['BROKER_'+letter]+"','"+contract_id+"','"+agreement+"')")
admin=sessions['ADMIN']['access_token']; tenant=sessions['TENANT_A']['access_token']
for role in ['TENANT_A','TENANT_B','OWNER_A','OWNER_B','BROKER_A','BROKER_B']:
 token=sessions[role]['access_token']; status,body=call(APP,'/api/portal/dashboard',token)
 expected=contracts[0 if role.endswith('A') else 1]
 assert status==200 and len(body['contracts'])==1 and body['contracts'][0]['id']==expected
 assert call(APP,'/api/portal/records/contract/'+expected,token)[0]==200
 assert call(APP,'/api/portal/records/contract/'+contracts[1 if role.endswith('A') else 0],token)[0]==404
 assert call(APP,'/api/portal/actions',token,{'operation':'KPI_SAVE','broker_user_id':users['BROKER_A'],'name':'Forbidden','metric':'commission','target':100,'period':'monthly','period_start':'2026-10-01','period_end':'2026-10-31'})[0]==403
 print(role+': scoped dashboard, direct other-user record HTTP 404 and management denial passed',flush=True)
status,result=call(APP,'/api/portal/actions',tenant,{'operation':'MAINTENANCE_CREATE','property_id':props[0],'contract_id':contracts[0],'category':'سباكة','description':'تسريب يحتاج زيارة فنية'})
assert status==200; task=result['id']
assert call(APP,'/api/portal/actions',sessions['TENANT_B']['access_token'],{'operation':'MAINTENANCE_TRANSITION','task_id':task,'status':'cancelled'})[0]==403
assert call(APP,'/api/portal/actions',admin,{'operation':'MAINTENANCE_TRANSITION','task_id':task,'status':'completed'})[0]==400
assert call(APP,'/api/portal/actions',admin,{'operation':'MAINTENANCE_TRANSITION','task_id':task,'status':'under_review'})[0]==200
assert call(APP,'/api/portal/actions',admin,{'operation':'MAINTENANCE_QUOTE','task_id':task,'cost':250,'cost_bearer':'tenant','cost_customer_id':users['TENANT_A']})[0]==200
assert call(APP,'/api/portal/actions',admin,{'operation':'MAINTENANCE_TRANSITION','task_id':task,'status':'awaiting_customer_approval'})[0]==200
assert call(APP,'/api/portal/actions',tenant,{'operation':'MAINTENANCE_TRANSITION','task_id':task,'status':'awaiting_manager_approval','note':'موافق على التكلفة'})[0]==200
print('Maintenance HTTP scope, invalid transitions, quote and customer approval passed',flush=True)
# Actual private photo upload and signed download; use a tiny fake PNG.
png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNlcAAAAASUVORK5CYII=')
boundary='kohl'+uuid.uuid4().hex
multipart=(f'--{boundary}\r\nContent-Disposition: form-data; name="task_id"\r\n\r\n{task}\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+png+f'\r\n--{boundary}--\r\n'.encode())
request=urllib.request.Request(APP+'/api/portal/attachments',data=multipart,headers={'Content-Type':'multipart/form-data; boundary='+boundary,'Authorization':'Bearer '+tenant})
with urllib.request.urlopen(request,timeout=30) as response: assert response.status==200
status,data=call(APP,'/api/portal/dashboard',tenant); attachment=data['maintenance'][0]['attachments'][0]['id']
assert call(APP,'/api/portal/attachments?task_id='+task+'&attachment_id='+attachment,sessions['TENANT_B']['access_token'])[0]==403
status,signed=call(APP,'/api/portal/attachments?task_id='+task+'&attachment_id='+attachment,tenant)
assert status==200 and urllib.request.urlopen(signed['url']).read()==png
print('Photo upload, private storage, cross-account denial and signed download passed',flush=True)
payment=str(uuid.uuid4())
sql("insert into public.financial_transactions(id,transaction_date,transaction_type,category,amount,net_profit,payment_method,property_id,contract_id,description,period_start,period_end) values ('"+payment+"','2026-10-01','INCOME','RENTAL_PAYMENT',1000,1000,'Cash','"+props[0]+"','"+contracts[0]+"','دفعة اختبار','2026-10-01','2026-10-31')")
assert call(APP,'/api/portal/documents',sessions['TENANT_B']['access_token'],{'kind':'payment','payment_id':payment})[0]==403
for kind,token,payload in [('payment',tenant,{'kind':'payment','payment_id':payment}),('statement',sessions['OWNER_A']['access_token'],{'kind':'statement','start':'2026-10-01','end':'2026-10-31'})]:
 status,pdf=call(APP,'/api/portal/documents',token,payload,binary=True)
 assert status==200 and pdf.startswith(b'%PDF'), 'Arabic '+kind+' PDF failed'
 (PRIVATE/(kind+'-qa.pdf')).write_bytes(pdf)
 code=sql("select verification_code from portal_private.documents where kind='"+kind+"' order by created_at desc limit 1")
 status,proof=call(APP,'/api/documents/verify/'+code)
 assert status==200 and set(proof)=={'valid','kind','created_at'}
print('Payment and owner statement PDFs generated; public verification exposes no personal/financial data',flush=True)
assert call(APP,'/api/portal/dashboard')[0]==401
(PRIVATE/'qa-sessions.json').write_text(json.dumps(sessions))
(STAGE/'portal-acceptance.json').write_text(json.dumps({'passed':True,'image':IMAGE,'image_id':inspect(IMAGE)['Id'],'database':DB,'roles':list(sessions)}))
print('Real portal API acceptance passed; isolated services retained for visual QA',flush=True)
gateway.shutdown()
