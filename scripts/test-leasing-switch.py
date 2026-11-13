"""Real GoTrue/PostgREST + locally built Next acceptance; synthetic disposable data only.
Needs npm run build, Docker and the three pinned images. Never reads production state.
"""
import base64
import hashlib
import hmac
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid
from postgres_test_runtime import wait_for_postgres

ROOT = Path(__file__).resolve().parent.parent
IMAGES = {
 'db':'postgres@sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac',
 'auth':'supabase/gotrue@sha256:385184459f57569c54c25209f51f3b2be99ddd7c4ce9e3555b5d3eea8447b7cf',
 'rest':'postgrest/postgrest@sha256:54000f24847d01a2c2302e0041cf0618b875c57fb48507d743cfa9aaa50bf43c',
}
def jwt(secret,role):
 def b64(v):return base64.urlsafe_b64encode(v).decode().rstrip('=')
 body=b64(b'{"alg":"HS256","typ":"JWT"}')+'.'+b64(json.dumps({'role':role,'iss':'supabase','exp':int(time.time())+3600}).encode())
 return body+'.'+b64(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest())
def freeport():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def main():
 os.umask(0o077)
 if not (ROOT/'.next/BUILD_ID').is_file():raise SystemExit('STOP: build the candidate first')
 folder=Path(tempfile.mkdtemp(prefix='kohl-leasing-switch-'))
 network='kohl_leasing_test_'+uuid.uuid4().hex[:10]
 names={k:network+'_'+k for k in IMAGES}
 created=[]; network_created=False; app=None; gateway=None; stage='preflight'
 secret=secrets.token_hex(32); password=secrets.token_hex(24)
 anon=jwt(secret,'anon');service=jwt(secret,'service_role')
 with (folder/'private.log').open('w+b') as log:
  def run(args,**kw):return subprocess.run(args,check=True,stderr=log,**kw)
  def sql(statement):return run(['docker','exec','-i',names['db'],'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=statement.encode(),stdout=log)
  def start(kind,env,port=None):
   envfile=folder/(kind+'.env');envfile.write_text(''.join(k+'='+v+'\n' for k,v in env.items()))
   command=['docker','create','--pull','never','--name',names[kind],'--network',network,'--network-alias',kind,'--memory','512m','--pids-limit','256','--env-file',str(envfile)]
   command+=[IMAGES[kind]]
   run(command,stdout=log);created.append(names[kind]);run(['docker','start',names[kind]],stdout=log);envfile.unlink()
   if port:
    binding=json.loads(subprocess.check_output(['docker','inspect','--format','{{json .NetworkSettings.Networks}}',names[kind]],text=True))
    return binding[network]['IPAddress']
  opener=urllib.request.build_opener(urllib.request.ProxyHandler({})) # Only loopback and IPs of our disposable internal-network containers.
  def http(base,path,token=None,body=None,method=None,headers=None):
   h={'apikey':anon,**(headers or {})}
   if token:h['Authorization']='Bearer '+token
   if body is not None:h['Content-Type']='application/json'
   req=urllib.request.Request(base+path,headers=h,data=json.dumps(body).encode() if body is not None else None,method=method or ('POST' if body is not None else 'GET'))
   try:r=opener.open(req,timeout=15)
   except urllib.error.HTTPError as e:r=e
   return r.status,r.read(),r.headers
  def require(result,status=200):
   if result[0]!=status:
    log.write(b'HTTP '+str(result[0]).encode()+b' '+result[1]+b'\n');log.flush();raise RuntimeError('HTTP expected '+str(status)+', received '+str(result[0]))
   return json.loads(result[1]) if result[1] else None
  def ready(base,path):
   for _ in range(60):
    try:
     if http(base,path)[0]==200:return
    except (OSError,urllib.error.URLError):pass
    time.sleep(.5)
   raise RuntimeError('Service readiness timeout')
  try:
   for image in IMAGES.values():run(['docker','image','inspect',image],stdout=log)
   run(['docker','network','create','--internal',network],stdout=log);network_created=True
   start('db',{'POSTGRES_PASSWORD':password,'PGPASSWORD':password});wait_for_postgres(names['db'])
   sql(f"""CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '{password}';GRANT anon,authenticated,service_role TO authenticator;
CREATE ROLE supabase_auth_admin LOGIN CREATEROLE PASSWORD '{password}';
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;CREATE SCHEMA extensions;
ALTER ROLE supabase_auth_admin SET search_path=auth,public,extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role,supabase_auth_admin;""")
   stage='real Auth startup'
   authport=start('auth',{'GOTRUE_API_HOST':'0.0.0.0','GOTRUE_API_PORT':'9999','API_EXTERNAL_URL':'http://auth:9999','GOTRUE_SITE_URL':'http://localhost:3000','GOTRUE_DB_DRIVER':'postgres','GOTRUE_DB_DATABASE_URL':f'postgres://supabase_auth_admin:{password}@db:5432/postgres','GOTRUE_JWT_SECRET':secret,'GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_DISABLE_SIGNUP':'true','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_MAILER_AUTOCONFIRM':'true'},9999)
   authbase='http://'+authport+':9999';ready(authbase,'/health')
   sql("""CREATE SCHEMA portal_private;CREATE SCHEMA storage;
CREATE TABLE portal_private.accounts(user_id uuid primary key references auth.users,full_name text,mobile text,role text constraint accounts_role_check check(role in ('ADMIN','CEO','HR','EMPLOYEE','BROKER','OWNER','TENANT')),is_active boolean,employee_id uuid,created_by uuid,invitation_status text);
CREATE TABLE public.properties(id uuid primary key,property_name text);
CREATE TABLE public.crm_leads(id uuid primary key,lead_code text unique,name text,phone text,source text,assigned_agent_id uuid,lead_type text);
CREATE TABLE public.contracts(id uuid primary key,contract_number text);
CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA portal_private TO service_role;
CREATE FUNCTION public.portal_me() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('account',jsonb_build_object('id',user_id,'name',full_name,'role',role,'history_only',false)) FROM portal_private.accounts WHERE user_id=auth.uid() AND is_active $$;
REVOKE ALL ON FUNCTION public.portal_me() FROM public;GRANT EXECUTE ON FUNCTION public.portal_me() TO authenticated;""")
   def account(label,role):
    email=label+'@example.invalid'
    user=require(http(authbase,'/admin/users',service,{'email':email,'password':password,'email_confirm':True}))
    uid=str(uuid.UUID(user['id']))
    sql(f"INSERT INTO portal_private.accounts(user_id,full_name,mobile,role,is_active) VALUES('{uid}','Synthetic {label}','0500000000','{role}',true);")
    return uid,require(http(authbase,'/token?grant_type=password',body={'email':email,'password':password}))
   owner,parent=account('manager','ADMIN');final,_=account('final','CEO');_,other=account('other','ADMIN')
   stage='isolated migrations'
   for name in ['20261110143135_leasing_internal_finance.sql','20261110215449_operations_private_documents.sql']:
    sql((ROOT/'supabase/migrations'/name).read_text())
   sql(f"SELECT set_config('kohl.workflow_manager','{owner}',false),set_config('kohl.workflow_final','{final}',false);"+(ROOT/'supabase/migrations/20261112172325_operations_approval_chain.sql').read_text())
   sql((ROOT/'supabase/migrations/20261113202336_leasing_specialist_account.sql').read_text())
   restport=start('rest',{'PGRST_DB_URI':f'postgres://authenticator:{password}@db:5432/postgres','PGRST_DB_SCHEMAS':'public','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':secret},3000)
   restbase='http://'+restport+':3000';ready(restbase,'/')
   class Gateway(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def proxy(self):
     prefix,host,port=('/auth/v1',authport,9999) if self.path.startswith('/auth/v1/') else ('/rest/v1',restport,3000)
     if not self.path.startswith(prefix+'/'):self.send_error(404);return
     upstream=HTTPConnection(host,port,timeout=15)
     try:
      body=self.rfile.read(int(self.headers.get('content-length','0')))
      upstream.request(self.command,self.path[len(prefix):],body,{k:v for k,v in self.headers.items() if k.lower() not in ('host','connection')})
      response=upstream.getresponse();data=response.read();self.send_response(response.status)
      for k,v in response.getheaders():
       if k.lower() not in ('transfer-encoding','connection','content-length'):self.send_header(k,v)
      self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
     finally:upstream.close()
    do_GET=do_POST=do_PUT=do_DELETE=proxy
   gateway=ThreadingHTTPServer(('127.0.0.1',0),Gateway);threading.Thread(target=gateway.serve_forever,daemon=True).start()
   port=freeport();base='http://127.0.0.1:'+str(port)
   env={**os.environ,'SUPABASE_SERVER_URL':'http://127.0.0.1:'+str(gateway.server_port),'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:'+str(gateway.server_port),'NEXT_PUBLIC_SUPABASE_ANON_KEY':anon,'SUPABASE_SERVICE_ROLE_KEY':service,'APP_ORIGIN':base,'NEXT_TELEMETRY_DISABLED':'1'}
   app=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',str(port)],cwd=ROOT,env=env,stdout=log,stderr=log)
   ready(base,'/api/auth/providers');stage='owner-only real switch'
   require(http(base,'/api/auth/leasing-switch',other['access_token']),403)
   require(http(base,'/api/auth/leasing-switch',parent['access_token'],{'operation':'ENTER','refresh_token':parent['refresh_token']}),403)
   switched=http(base,'/api/auth/leasing-switch',parent['access_token'],{'operation':'ENTER','refresh_token':parent['refresh_token']},headers={'Origin':base})
   child=require(switched)['session'];cookie=switched[2]['Set-Cookie'].split(';')[0]
   assert parent['refresh_token'] not in switched[1].decode()
   profile=require(http(base,'/api/portal/me',child['access_token']));assert profile['account']['role']=='LEASING'
   workspace=require(http(base,'/api/operations',child['access_token']));assert not workspace['cases'] and not workspace['leads']
   for path in ['/api/access/users','/api/operations/export','/api/operations/documents','/api/portal/dashboard']:
    require(http(base,path,child['access_token']),403)
   assert http(restbase,'/crm_leads?select=*',child['access_token'])[0] in (401,403)
   assert http(restbase,'/rpc/kohl_operations',child['access_token'],{'operation':'LIST','payload':{}})[0] in (401,403)
   contact=str(uuid.uuid4());case=str(uuid.uuid4())
   require(http(base,'/api/operations',child['access_token'],{'operation':'CONTACT_CREATE','id':contact,'name':'New contact','phone':'0500000001','source':'هاتف'}))
   require(http(base,'/api/operations',child['access_token'],{'operation':'CASE_CREATE','id':case,'lead_id':contact,'kind':'DAILY','source':'هاتف','need':'Unit','next_action':'Call','due_at':'2026-12-01T10:00:00Z'}))
   require(http(base,'/api/operations',child['access_token'],{'operation':'ENTRY_DECIDE','id':str(uuid.uuid4()),'status':'APPROVED','note':'Forbidden'}),403)
   stage='return binding and parent revocation'
   # A second real child login has no registered delegation and cannot use the first cookie.
   child_user=require(http(authbase,'/user',child['access_token']))
   link=require(http(authbase,'/admin/generate_link',service,{'type':'magiclink','email':child_user['email']}))
   unrelated=require(http(authbase,'/verify',body={'type':'magiclink','token_hash':link['hashed_token']}))
   require(http(base,'/api/auth/leasing-switch',unrelated['access_token'],{'operation':'RETURN'},headers={'Origin':base,'Cookie':cookie}),403)
   assert http(base,'/api/operations',unrelated['access_token'])[0] in (401,403)

   require(http(base,'/api/auth/leasing-switch',child['access_token'],{'operation':'RETURN'},headers={'Origin':base}),401)
   returned=require(http(base,'/api/auth/leasing-switch',child['access_token'],{'operation':'RETURN'},headers={'Origin':base,'Cookie':cookie}))['session']
   assert require(http(authbase,'/user',returned['access_token']))['id']==owner
   assert http(base,'/api/operations',child['access_token'])[0] in (401,403)
   # Refreshing a child cannot grant administrative capabilities.
   switched=http(base,'/api/auth/leasing-switch',returned['access_token'],{'operation':'ENTER','refresh_token':returned['refresh_token']},headers={'Origin':base})
   child2=require(switched)['session']
   renewed=require(http(authbase,'/token?grant_type=refresh_token',body={'refresh_token':child2['refresh_token']}))
   assert require(http(base,'/api/portal/me',renewed['access_token']))['account']['role']=='LEASING'
   require(http(authbase,'/user',renewed['access_token'],{'data':{'role':'ADMIN'}},method='PUT'))
   assert require(http(base,'/api/portal/me',renewed['access_token']))['account']['role']=='LEASING'
   require(http(authbase,'/logout?scope=global',returned['access_token'],method='POST'),204)
   assert http(base,'/api/operations',renewed['access_token'])[0] in (401,403)
   print('REAL LEASING SWITCH PASSED: custom Auth role, new requests, direct API/REST denial, encrypted return, refresh isolation and parent logout revocation',flush=True)
  except Exception as e:
   for name in created:subprocess.run(['docker','logs',name],stdout=log,stderr=log)
   print('STOP: leasing switch test failed at '+stage+' ('+type(e).__name__+')',flush=True)
   print('Private diagnostics: '+str(folder/'private.log')+'; do not paste raw logs.',flush=True)
   raise SystemExit(1)
  finally:
   if app:
    app.terminate()
    try:app.wait(timeout=10)
    except subprocess.TimeoutExpired:app.kill();app.wait()
   if gateway:gateway.shutdown();gateway.server_close()
   for name in reversed(created):subprocess.run(['docker','rm','-f',name],stdout=log,stderr=log)
   if network_created:subprocess.run(['docker','network','rm',network],stdout=log,stderr=log)
   print('Temporary test services removed; production unchanged.',flush=True)
if __name__=='__main__':main()
