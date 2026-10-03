"""Isolated, loopback-only Phase A preview. No production data or real mail.
Run on the VPS after test-phase-a-invite.py prepared the named test database.
Stop with Ctrl+C; containers and credential files are cleaned up in finally.
"""
import base64, hashlib, hmac, http.server, json, os, socketserver, subprocess, tempfile, threading, time, urllib.request, urllib.error
from urllib.parse import quote, urlsplit, urlunsplit

DB='kohl_portal_phasea_test_auth2'
SECRET='isolated-phase-a-api-test-secret-not-a-production-key-2026'
AUTH_NAME='kohl-portal-phasea-preview-auth'; REST_NAME='kohl-portal-phasea-preview-rest'
AUTH_PORT=39022; REST_PORT=39021; GATEWAY_PORT=39023; SMTP_PORT=39025
ORIGIN='http://localhost:3102'
def inspect(name):return json.loads(subprocess.check_output(['docker','inspect',name],text=True))[0]
def env(container):return dict(x.split('=',1) for x in container['Config']['Env'])
def sql(query):
 p=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB],input=query,text=True,capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr)
 return p.stdout
def key(role):
 def enc(value):return base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).rstrip(b'=').decode()
 body=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':role,'aud':'authenticated','exp':int(time.time())+86400})
 return body+'.'+base64.urlsafe_b64encode(hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
class SMTP(socketserver.StreamRequestHandler):
 def handle(self):
  self.wfile.write(b'220 isolated.local ESMTP\r\n');data=False
  while True:
   line=self.rfile.readline()
   if not line:return
   if data:
    if line==b'.\r\n':data=False;self.wfile.write(b'250 captured locally\r\n')
    continue
   upper=line.upper()
   if upper.startswith(b'EHLO'):self.wfile.write(b'250-isolated.local\r\n250 AUTH PLAIN\r\n')
   elif upper.startswith(b'DATA'):data=True;self.wfile.write(b'354 data\r\n')
   elif upper.startswith(b'QUIT'):self.wfile.write(b'221 bye\r\n');return
   else:self.wfile.write(b'250 OK\r\n')
class Gateway(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def headers_cors(self):
  self.send_header('Access-Control-Allow-Origin',ORIGIN)
  self.send_header('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,prefer,accept-profile,content-profile,x-supabase-api-version')
  self.send_header('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS')
 def do_OPTIONS(self):self.send_response(204);self.headers_cors();self.end_headers()
 def route(self):
  if self.path.startswith('/auth/v1/'):
   port=AUTH_PORT;path=self.path[len('/auth/v1/'):]
  elif self.path.startswith('/rest/v1/'):
   port=REST_PORT;path=self.path[len('/rest/v1/'):]
  else:self.send_error(404);return
  body=self.rfile.read(int(self.headers.get('Content-Length',0))) if self.command not in ('GET','DELETE') else None
  headers={k:v for k,v in self.headers.items() if k.lower() not in ('host','connection','origin','content-length')}
  req=urllib.request.Request(f'http://127.0.0.1:{port}/'+path,data=body,method=self.command,headers=headers)
  try:
   response=urllib.request.urlopen(req,timeout=15)
  except urllib.error.HTTPError as error:response=error
  self.send_response(response.status);self.headers_cors()
  for k,v in response.headers.items():
   if k.lower() not in ('connection','transfer-encoding','content-length') and not k.lower().startswith('access-control-'):self.send_header(k,v)
  content=response.read();self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)
 do_GET=route;do_POST=route;do_PUT=route;do_PATCH=route;do_DELETE=route

auth=inspect('supabase-auth');rest=inspect('supabase-rest');db=inspect('supabase-db')
network=next(iter(auth['NetworkSettings']['Networks']))
db_address=db['NetworkSettings']['Networks'][network]['IPAddress']
original_auth=env(auth);database=env(db);uri=urlsplit(original_auth['GOTRUE_DB_DATABASE_URL'])
auth_env={k:v for k,v in original_auth.items() if (k.startswith('GOTRUE_') or k.startswith('API_')) and not k.startswith(('GOTRUE_HOOK_','GOTRUE_MAILER_TEMPLATES_'))}
auth_env.update({'GOTRUE_DB_DATABASE_URL':urlunsplit((uri.scheme,'postgres:'+quote(database['POSTGRES_PASSWORD'],safe='')+'@'+db_address+':5432','/'+DB,'search_path=auth,public,extensions','')),
 'GOTRUE_JWT_SECRET':SECRET,'GOTRUE_SITE_URL':ORIGIN,'GOTRUE_URI_ALLOW_LIST':ORIGIN+'/auth/set-password',
 'API_EXTERNAL_URL':f'http://localhost:{GATEWAY_PORT}/auth/v1','GOTRUE_API_HOST':'127.0.0.1','GOTRUE_API_PORT':str(AUTH_PORT),
 'API_HOST':'127.0.0.1','API_PORT':str(AUTH_PORT),'GOTRUE_SMTP_HOST':'127.0.0.1','GOTRUE_SMTP_PORT':str(SMTP_PORT),
 'GOTRUE_SMTP_USER':'','GOTRUE_SMTP_PASS':'','GOTRUE_SMTP_ADMIN_EMAIL':'test@kohl.invalid','GOTRUE_SMTP_SENDER_NAME':'Isolated Kohl preview',
 'GOTRUE_DISABLE_SIGNUP':'true','GOTRUE_MAILER_AUTOCONFIRM':'false','GOTRUE_RATE_LIMIT_EMAIL_SENT':'100','GOTRUE_SMTP_MAX_FREQUENCY':'0s'})
rest_uri=urlsplit(env(rest)['PGRST_DB_URI'])
rest_env={'PGRST_DB_URI':urlunsplit((rest_uri.scheme,rest_uri.netloc,'/'+DB,rest_uri.query,'')),
 'PGRST_DB_SCHEMAS':'public','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':SECRET}
paths=[];smtp=None
try:
 # Match the live PostgreSQL Auth UID helper rather than GoTrue's older init helper.
 definition=subprocess.check_output(['docker','exec','supabase-db','psql','-X','-At','-U','postgres','-d','postgres','-c',"select pg_get_functiondef('auth.uid()'::regprocedure)"],text=True)
 sql(definition)
 smtp=socketserver.ThreadingTCPServer(('127.0.0.1',SMTP_PORT),SMTP);threading.Thread(target=smtp.serve_forever,daemon=True).start()
 for name,values,image,options in [(AUTH_NAME,auth_env,auth['Config']['Image'],['--network','host']),
  (REST_NAME,rest_env,rest['Config']['Image'],['--network',network,'-p',f'127.0.0.1:{REST_PORT}:3000'])]:
  fd,path=tempfile.mkstemp(prefix='kohl-phasea-preview-',suffix='.env');os.chmod(path,0o600);paths.append(path)
  with os.fdopen(fd,'w') as f:
   for k,v in values.items():f.write(k+'='+v+'\n')
  subprocess.run(['docker','run','-d','--name',name,*options,'--env-file',path,image],check=True,capture_output=True)
 for attempt in range(30):
  try:
   urllib.request.urlopen(f'http://127.0.0.1:{AUTH_PORT}/health',timeout=2);break
  except OSError:time.sleep(.2)
 req=urllib.request.Request(f'http://127.0.0.1:{AUTH_PORT}/admin/users',method='POST',headers={'Authorization':'Bearer '+key('service_role'),'Content-Type':'application/json'},data=json.dumps({'email':'phase-a-admin@test.invalid','password':'Kohl-Preview-2026!','email_confirm':True}).encode())
 try:
  with urllib.request.urlopen(req,timeout=10) as response:identity=json.loads(response.read())
 except urllib.error.HTTPError as error:
  if error.code not in (422,400):raise
  req=urllib.request.Request(f'http://127.0.0.1:{AUTH_PORT}/token?grant_type=password',method='POST',headers={'Authorization':'Bearer '+key('anon'),'Content-Type':'application/json'},data=json.dumps({'email':'phase-a-admin@test.invalid','password':'Kohl-Preview-2026!'}).encode())
  with urllib.request.urlopen(req,timeout=10) as response:identity=json.loads(response.read())['user']
 user_id=identity['id']
 sql("insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values ('"+user_id+"','Phase A preview admin','0500000000','ADMIN',true) on conflict(user_id) do nothing;")
 # Fixture-only properties and active leases, with no real customers.
 sql("""insert into public.lessors(id,name,national_id_or_cr,phone) values ('20000000-0000-4000-8000-000000000001','Preview owner','preview-id','0500000000') on conflict do nothing;
 insert into public.properties(id,property_name,property_type,address,city,lessor_id) values
 ('30000000-0000-4000-8000-000000000001','Preview property 1','Residential','Preview address','Riyadh','20000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','Preview property 2','Residential','Preview address','Riyadh','20000000-0000-4000-8000-000000000001') on conflict do nothing;
 insert into public.contracts(id,contract_number,type,property_id,lessor_id,tenant_name,rent_amount,payment_schedule,start_date,end_date,status) values
 ('40000000-0000-4000-8000-000000000001','PREVIEW-1','RESIDENTIAL','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Preview tenant 1',12000,'Monthly','2026-01-01','2099-12-31','active'),
 ('40000000-0000-4000-8000-000000000002','PREVIEW-2','RESIDENTIAL','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Preview tenant 2',12000,'Monthly','2026-01-01','2099-12-31','active') on conflict do nothing;""")
 print('Isolated preview ready; mail remains local; no production records are used.',flush=True)
 http.server.ThreadingHTTPServer(('127.0.0.1',GATEWAY_PORT),Gateway).serve_forever()
finally:
 for name in (AUTH_NAME,REST_NAME):subprocess.run(['docker','rm','-f',name],capture_output=True)
 if smtp:smtp.shutdown();smtp.server_close()
 for path in paths:os.unlink(path)
