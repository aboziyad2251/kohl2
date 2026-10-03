"""Real GoTrue invite/password round trip with local SMTP capture and fake users.
Uses the isolated schema clone and existing Docker images. Never sends mail to
an external SMTP server. Its credentials and JWT secret are isolated test data.
"""
import base64, hashlib, hmac, json, os, re, socketserver, subprocess, tempfile, threading, time, urllib.request, urllib.error, uuid
from urllib.parse import quote, urlsplit, urlunsplit
DB='kohl_portal_phasea_test_auth2'
assert DB.startswith('kohl_portal_phasea_test')
NAME='kohl-portal-phasea-auth-test'; PORT=39022; SMTP_PORT=39025
SECRET='isolated-phase-a-api-test-secret-not-a-production-key-2026'
messages=[]
checks=0
def check(value,label):
 global checks
 assert value,label
 checks+=1; print('PASS',label,flush=True)
def token(role):
 def enc(x):return base64.urlsafe_b64encode(json.dumps(x).encode()).rstrip(b'=').decode()
 body=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':role,'aud':'authenticated','exp':int(time.time())+600})
 return body+'.'+base64.urlsafe_b64encode(hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
def request(path,payload=None,bearer=None,method='POST'):
 req=urllib.request.Request(f'http://127.0.0.1:{PORT}/'+path,headers={'Authorization':'Bearer '+(bearer or token('service_role')),'Content-Type':'application/json'},data=json.dumps(payload).encode() if payload is not None else None,method=method)
 try:
  with urllib.request.urlopen(req,timeout=10) as response:return response.status,json.loads(response.read())
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
def sql(query):
 result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d',DB],input=query,text=True,capture_output=True)
 if result.returncode:raise RuntimeError(result.stderr)
 return result.stdout
class SMTP(socketserver.StreamRequestHandler):
 def handle(self):
  self.wfile.write(b'220 test.local ESMTP\r\n'); collecting=False;content=[]
  while True:
   raw=self.rfile.readline()
   if not raw:return
   if collecting:
    if raw==b'.\r\n':messages.append(b''.join(content).decode(errors='replace'));collecting=False;content=[];self.wfile.write(b'250 accepted\r\n')
    else:content.append(raw)
    continue
   line=raw.upper()
   if line.startswith(b'EHLO'):self.wfile.write(b'250-test.local\r\n250 AUTH PLAIN\r\n')
   elif line.startswith(b'HELO'):self.wfile.write(b'250 test.local\r\n')
   elif line.startswith(b'DATA'):collecting=True;self.wfile.write(b'354 data\r\n')
   elif line.startswith(b'QUIT'):self.wfile.write(b'221 bye\r\n');return
   else:self.wfile.write(b'250 OK\r\n')
auth=json.loads(subprocess.check_output(['docker','inspect','supabase-auth'],text=True))[0]
env=dict(x.split('=',1) for x in auth['Config']['Env'])
db=json.loads(subprocess.check_output(['docker','inspect','supabase-db'],text=True))[0]
dbenv=dict(x.split('=',1) for x in db['Config']['Env'])
network=next(iter(auth['NetworkSettings']['Networks']))
net=json.loads(subprocess.check_output(['docker','network','inspect',network],text=True))[0]
gateway='127.0.0.1'
db_address=db['NetworkSettings']['Networks'][network]['IPAddress']
uri=urlsplit(env['GOTRUE_DB_DATABASE_URL'])
env={key:value for key,value in env.items() if not key.startswith(('GOTRUE_HOOK_','GOTRUE_MAILER_TEMPLATES_'))}
env.update({'GOTRUE_DB_DATABASE_URL':urlunsplit((uri.scheme,'postgres:'+quote(dbenv['POSTGRES_PASSWORD'],safe='')+'@'+db_address+':'+str(uri.port or 5432),'/'+DB,'search_path=auth,public,extensions','')),
 'GOTRUE_JWT_SECRET':SECRET,'GOTRUE_SITE_URL':'http://localhost:3101','GOTRUE_URI_ALLOW_LIST':'http://localhost:3101/auth/set-password',
 'API_EXTERNAL_URL':f'http://127.0.0.1:{PORT}','API_HOST':'127.0.0.1','API_PORT':str(PORT),
 'GOTRUE_API_HOST':'127.0.0.1','GOTRUE_API_PORT':str(PORT),'GOTRUE_SMTP_HOST':gateway,'GOTRUE_SMTP_PORT':str(SMTP_PORT),
 'GOTRUE_SMTP_USER':'','GOTRUE_SMTP_PASS':'','GOTRUE_SMTP_ADMIN_EMAIL':'test@kohl.invalid','GOTRUE_SMTP_SENDER_NAME':'Kohl Test',
 'GOTRUE_DISABLE_SIGNUP':'true','GOTRUE_MAILER_AUTOCONFIRM':'false','GOTRUE_RATE_LIMIT_EMAIL_SENT':'100','GOTRUE_SMTP_MAX_FREQUENCY':'0s'})
# Use a fresh Auth schema created by the installed GoTrue image. The production
# schema clone exposed a version mismatch in its OAuth migration definitions.
sql('create schema if not exists auth;')
server=socketserver.ThreadingTCPServer((gateway,SMTP_PORT),SMTP);threading.Thread(target=server.serve_forever,daemon=True).start()
fd,path=tempfile.mkstemp(prefix='kohl-auth-test-',suffix='.env');os.chmod(path,0o600)
try:
 with os.fdopen(fd,'w') as f:
  for key,value in env.items():
   if key.startswith('GOTRUE_') or key.startswith('API_'):f.write(key+'='+value+'\n')
 subprocess.run(['docker','run','-d','--name',NAME,'--network','host','--env-file',path,auth['Config']['Image']],check=True,capture_output=True)
 status=0
 for attempt in range(40):
  try:
   status,_=request('health',method='GET')
   if status==200:break
  except OSError:pass
  time.sleep(.25)
 if status!=200:
  logs=subprocess.run(['docker','logs','--tail','8',NAME],text=True,capture_output=True)
  safe=(logs.stdout+logs.stderr).replace(dbenv['POSTGRES_PASSWORD'],'[redacted]').replace(env.get('GOTRUE_JWT_SECRET','!'),'[redacted]')
  print(safe,flush=True)
 check(status==200,'isolated GoTrue starts with installed schema/version')
 present=subprocess.check_output(['docker','exec','supabase-db','psql','-X','-At','-U','postgres','-d',DB,'-c',"select to_regnamespace('portal_private') is not null"],text=True).strip()=='t'
 if not present:sql(open('/tmp/20261003000256_external_portals_phase_a.sql').read())
 status,admin_user=request('admin/users',{'email':'admin-'+uuid.uuid4().hex+'@test.invalid','password':'Admin-Test-Password-2026!','email_confirm':True})
 if status not in (200,201):print('test identity creation:',status,admin_user.get('error_code'),admin_user.get('msg'),flush=True)
 check(status in (200,201),'test executive identity created without an email')
 actor=admin_user['id']
 sql("insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values ('"+actor+"','Test admin','0500000000','ADMIN',true);")
 email='invite-'+uuid.uuid4().hex+'@test.invalid'
 status,body=request('admin/generate_link',{'type':'invite','email':email,'redirect_to':'http://localhost:3101/auth/set-password'})
 check(status==200,'generateLink creates unconfirmed identity')
 target=body['id'];check(len(messages)==0,'generateLink sends no email before assignments exist')
 payload=json.dumps({'user_id':target,'full_name':'Invite test','mobile':'0500000000','role':'BROKER','agreement':{'agreement_number':uuid.uuid4().hex,'commission_type':'FIXED','commission_value':500,'percentage_basis':None},'broker_contracts':[]})
 sql("select public.portal_admin('"+actor+"','SAVE','"+payload+"'::jsonb,'"+str(uuid.uuid4())+"'); select public.portal_admin('"+actor+"','STATUS','{\"user_id\":\""+target+"\",\"is_active\":true}', '"+str(uuid.uuid4())+"');")
 status,_=request('invite?redirect_to=http%3A%2F%2Flocalhost%3A3101%2Fauth%2Fset-password',{'email':email})
 check(status==200 and len(messages)==1,'inviteUserByEmail works for pre-created unconfirmed user after links are committed')
 from email import message_from_string
 message=message_from_string(messages[-1]);parts=message.walk() if message.is_multipart() else [message]
 text='\n'.join(p.get_payload(decode=True).decode(errors='replace') for p in parts if p.get_content_type() in ('text/html','text/plain'))
 match=re.search(r'token=([A-Za-z0-9_-]+)',text);check(bool(match),'SMTP capture contains a usable invite link')
 status,body=request('verify',{'type':'invite','token_hash':match.group(1)})
 check(status==200 and bool(body.get('access_token')),'invite token verifies and establishes a real Auth session')
 access=body['access_token'];password='Kohl-Test-Password-2026!'
 status,_=request('user',{'password':password},access,'PUT');check(status==200,'first-login password is set through Supabase Auth')
 status,body=request('token?grant_type=password',{'email':email,'password':password},token('anon'))
 check(status==200 and body.get('user',{}).get('id')==target,'new user can sign in with the invited email and password')
 # Failed SMTP delivery is retriable for unconfirmed identities.
 status,_=request('signup',{'email':'unapproved@test.invalid','password':password},token('anon'))
 check(status in (400,403,422),'public signup disabled in cutover configuration')
 print(f'{checks} real Auth/SMTP checks passed. No external emails sent.',flush=True)
except Exception:
 logs=subprocess.run(['docker','logs','--tail','6',NAME],text=True,capture_output=True)
 safe=(logs.stdout+logs.stderr).replace(dbenv['POSTGRES_PASSWORD'],'[redacted]')
 for key,value in env.items():
  if value and len(value)>8 and any(x in key for x in ('SECRET','KEY','PASS','TOKEN')):safe=safe.replace(value,'[redacted]')
 print(safe,flush=True)
 raise
finally:
 subprocess.run(['docker','rm','-f',NAME],capture_output=True)
 server.shutdown();server.server_close();os.unlink(path)
