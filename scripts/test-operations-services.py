"""Synthetic Auth/PostgREST/Storage acceptance on an internal disposable network.
No production containers, volumes, configuration or backups are read or changed.
Images must already be present. Logs remain private; only stage/status is printed.
"""
import argparse
import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('restore', ROOT/'scripts/rehearse-operations-restore.py')
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)
IMAGES = {
 'db': restore.IMAGE,
 'auth': 'sha256:385184459f57569c54c25209f51f3b2be99ddd7c4ce9e3555b5d3eea8447b7cf',
 'rest': 'sha256:54000f24847d01a2c2302e0041cf0618b875c57fb48507d743cfa9aaa50bf43c',
 'storage': 'sha256:c8eb9858eafec891a97c27125470aaad54703c3f4eb4d55ca7f1bf6c6411febf',
 'runner': 'sha256:67885302ad2cabf226ce35aeaee3830283f55446f5319473ccce3a21ae515b46',
}

def token(secret, role):
    def b64(value):
        return base64.urlsafe_b64encode(value).decode().rstrip('=')
    header = b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = b64(json.dumps({'role': role, 'iss':'supabase', 'iat':int(time.time()), 'exp':int(time.time())+3600}).encode())
    body = header+'.'+payload
    return body+'.'+b64(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest())

# Installed only after GoTrue migrations, under the function owner's role.
# Support modern PostgREST claims in this synthetic fixture.
AUTH_HELPERS = """
BEGIN;
SET LOCAL ROLE supabase_auth_admin;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role' $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
COMMIT;
"""

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--application",action="store_true",help="Also test the exact application image APIs")
    args=parser.parse_args()
    os.umask(0o077)
    available = next(int(x.split()[1])*1024 for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:'))
    if available < 2*1024**3:
        raise SystemExit('STOP: at least 2 GiB available RAM required')
    for filename, expected in restore.EXPECTED_HASHES.items():
        if hashlib.sha256((ROOT/'supabase/migrations'/filename).read_bytes()).hexdigest()!=expected:
            raise SystemExit('STOP: candidate migration differs')
    suffix = uuid.uuid4().hex[:10]
    network = 'kohl_http_review_'+suffix
    names = {k:network+'_'+k for k in IMAGES}
    secret, password = secrets.token_hex(32), secrets.token_hex(24)
    anon, service = token(secret,'anon'), token(secret,'service_role')
    folder = Path(tempfile.mkdtemp(prefix='kohl-http-review-'))
    created, network_created, volume_created = [], False, False
    volume = network+'_files'
    stage = 'preflight'
    with (folder/'private.log').open('w+b') as log:
        def run(args, **kw):
            return subprocess.run(args, check=True, stderr=log, **kw)
        def sql(statement):
            return restore.query(names['db'], statement, log)
        def start(kind, env=None, extra=None, command=None, memory='256m'):
            envfile = folder/(kind+'.env')
            envfile.write_text(''.join(k+'='+v+'\n' for k,v in (env or {}).items()))
            args=['docker','create','--pull','never','--name',names[kind],
                  '--network',network,'--network-alias',kind,'--memory',memory,
                  '--cpus','1','--pids-limit','256','--env-file',str(envfile)]
            args += (extra or []) + [IMAGES[kind]] + (command or [])
            run(args,stdout=log); created.append(names[kind])
            run(['docker','start',names[kind]],stdout=log)
            envfile.unlink()
        def http(host, path, bearer=None, method='GET', body=None, raw=None, raw_type='application/pdf'):
            headers = {}
            if bearer: headers['Authorization']='Bearer '+bearer
            if raw is not None:
                headers['Content-Type']=raw_type
            elif body is not None:
                headers['Content-Type']='application/json'
            # Exact app calls include several service round-trips under test CPU limits.
            timeout_ms=30000 if path.startswith('/api/') else 5000
            request={'timeout_ms':timeout_ms,'url':host+path,'method':method,'headers':headers,
                     'body':base64.b64encode(raw).decode() if raw is not None else (json.dumps(body) if body is not None else None),
                     'binary':raw is not None}
            js="""let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',async()=>{
const started=Date.now();
try{const q=JSON.parse(s);const r=await fetch(q.url,{method:q.method,headers:q.headers,
body:q.body===null?undefined:q.binary?Buffer.from(q.body,'base64'):q.body,signal:AbortSignal.timeout(q.timeout_ms)});
console.log(JSON.stringify({status:r.status,body:Buffer.from(await r.arrayBuffer()).toString('base64'),elapsed_ms:Date.now()-started}));}
catch(e){console.log(JSON.stringify({status:0,body:'',elapsed_ms:Date.now()-started,transport_error:e.name}));}});"""
            result = run(['docker','exec','-i',names['runner'],'node','-e',js],
                         input=json.dumps(request).encode(),stdout=subprocess.PIPE,timeout=timeout_ms/1000+7)
            data=json.loads(result.stdout)
            if path.startswith('/api/'):
                failure=data.get('transport_error')
                safe_failure=failure if failure in ('TimeoutError','AbortError','TypeError') else 'unknown'
                print('APP HTTP: '+method+' '+path.split('?')[0]+' status='+str(data['status'])
                      +' elapsed_ms='+str(data.get('elapsed_ms','unknown'))
                      +(' transport='+safe_failure if data['status']==0 else ''),flush=True)
            return data['status'],base64.b64decode(data['body'])
        def require(result, expected=200):
            status, body=result
            if status != expected:
                log.write(b'\nHTTP result: '+str(status).encode()+b' '+body+b'\n')
                log.flush()
                print('HTTP STATUS: expected '+str(expected)+', received '+str(status), flush=True)
                raise RuntimeError('HTTP assertion failed')
            return json.loads(body) if body else None
        def wait_http(host,path):
            for _ in range(60):
                if http(host,path)[0]==200:return
                time.sleep(1)
            raise RuntimeError('service readiness failed')
        def rpc(op,payload,bearer):
            return http('http://rest:3000','/rpc/kohl_operations',bearer,'POST',{'operation':op,'payload':payload})
        def document(op,payload,actor):
            return http('http://rest:3000','/rpc/operations_document',service,'POST',{'actor':actor,'operation':op,'payload':payload})
        try:
            for image in IMAGES.values():
                run(['docker','image','inspect',image],stdout=subprocess.DEVNULL)
            run(['docker','network','create','--internal',network],stdout=log)
            network_created=True
            stage='database startup'
            boot="""set -eu
bin="$(pg_config --bindir)"
"$bin/initdb" -D /review/data -U postgres --encoding=UTF8 --locale=en_US.UTF-8 --auth-local=trust --auth-host=scram-sha-256 >/dev/null
printf '\nhost all all all scram-sha-256\n' >> /review/data/pg_hba.conf
exec "$bin/postgres" -D /review/data -k /review -c listen_addresses='*'
"""
            start('db',{'PGHOST':'/review'},['--user','postgres','--tmpfs','/review:rw,mode=1777,size=1g','--entrypoint','/bin/sh'],['-ec',boot],memory='512m')
            for _ in range(60):
                if subprocess.run(['docker','exec',names['db'],'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=log).returncode==0:break
                time.sleep(.5)
            sql(f"""
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '{password}';
CREATE ROLE supabase_auth_admin LOGIN CREATEROLE PASSWORD '{password}';
CREATE ROLE supabase_storage_admin LOGIN CREATEROLE NOINHERIT BYPASSRLS PASSWORD '{password}';
GRANT anon,authenticated,service_role TO authenticator,supabase_storage_admin;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
CREATE SCHEMA extensions;
ALTER ROLE supabase_auth_admin SET search_path=auth,public,extensions;
ALTER ROLE supabase_storage_admin SET search_path=storage,public,extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public,auth,extensions TO anon,authenticated,service_role,supabase_auth_admin,supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
""")
            runner_env={}
            runner_code='setInterval(()=>{},60000)'
            if args.application:
                runner_env={'SUPABASE_SERVER_URL':'http://127.0.0.1:8080',
                    'NEXT_PUBLIC_SUPABASE_URL':'http://127.0.0.1:8080','NEXT_PUBLIC_SUPABASE_ANON_KEY':anon,
                    'SUPABASE_SERVICE_ROLE_KEY':service,'HOSTNAME':'0.0.0.0','PORT':'3000',
                    'NEXT_TELEMETRY_DISABLED':'1'}
                runner_code=(ROOT/'tests/fixtures/operations-gateway.cjs').read_text()
            start('runner',runner_env,extra=['--entrypoint','node'],command=['-e',runner_code],memory='512m')
            stage='auth startup'
            start('auth',{
                'GOTRUE_API_HOST':'0.0.0.0','GOTRUE_API_PORT':'9999','API_EXTERNAL_URL':'http://auth:9999',
                'GOTRUE_SITE_URL':'http://runner:3000','GOTRUE_DB_DRIVER':'postgres',
                'GOTRUE_DB_DATABASE_URL':f'postgres://supabase_auth_admin:{password}@db:5432/postgres',
                'GOTRUE_JWT_SECRET':secret,'GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_JWT_AUD':'authenticated',
                'GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_DISABLE_SIGNUP':'true',
                'GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_MAILER_AUTOCONFIRM':'true',
            })
            wait_http('http://auth:9999','/health')
            stage='auth helper compatibility'
            sql(AUTH_HELPERS)
            stage='rest and storage startup'
            start('rest',{'PGRST_DB_URI':f'postgres://authenticator:{password}@db:5432/postgres',
                'PGRST_DB_SCHEMAS':'public,storage','PGRST_DB_ANON_ROLE':'anon','PGRST_JWT_SECRET':secret})
            # File storage needs xattrs; tmpfs does not provide them on every host.
            # Own a unique named volume, never a production bind mount.
            run(['docker','volume','create','--label','kohl.purpose=isolated-http-test',volume],stdout=log)
            volume_created=True
            start('storage',{'ANON_KEY':anon,'SERVICE_KEY':service,'AUTH_JWT_SECRET':secret,
                'POSTGREST_URL':'http://rest:3000','DATABASE_URL':f'postgres://supabase_storage_admin:{password}@db:5432/postgres',
                'STORAGE_BACKEND':'file','FILE_STORAGE_BACKEND_PATH':'/var/lib/storage',
                'GLOBAL_S3_BUCKET':'review','TENANT_ID':'review','REGION':'local','FILE_SIZE_LIMIT':'5242880',
                'ENABLE_IMAGE_TRANSFORMATION':'false'},
                extra=['--mount','type=volume,source='+volume+',target=/var/lib/storage'],memory='512m')
            wait_http('http://storage:5000','/status')
            stage='candidate migrations'
            sql("""
CREATE SCHEMA portal_private;
CREATE TABLE portal_private.accounts(user_id uuid primary key,full_name text,role text,is_active boolean,employee_id uuid);
CREATE TABLE public.properties(id uuid primary key,property_name text);
CREATE TABLE public.crm_leads(id uuid primary key,name text,phone text,source text,assigned_agent_id uuid);
CREATE TABLE public.contracts(id uuid primary key,contract_number text);
GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO service_role;
""")
            for filename in restore.MIGRATIONS:
                sql((ROOT/'supabase/migrations'/filename).read_text())
            time.sleep(2)
            stage='create synthetic auth user'
            user=require(http('http://auth:9999','/admin/users',service,'POST',{
                'email':'review@example.invalid','password':password,'email_confirm':True}))
            uid=str(uuid.UUID(user['id']))
            stage='password sign-in'
            login=require(http('http://auth:9999','/token?grant_type=password',None,'POST',{
                'email':'review@example.invalid','password':password}))
            access=login['access_token']
            stage='validate signed-in identity'
            assert require(http('http://auth:9999','/user',access))['id']==uid
            stage='reject invalid auth token'
            invalid_status=http('http://auth:9999','/user','invalid-token')[0]
            print('INVALID TOKEN HTTP STATUS: '+str(invalid_status),flush=True)
            if invalid_status not in (401,403):
                raise RuntimeError('Invalid token was not explicitly denied')
            print('REAL AUTH LOGIN OK',flush=True)
            sql(f"INSERT INTO portal_private.accounts VALUES('{uid}','Synthetic administrator','ADMIN',true,null);")
            stage='JWT-scoped finance RPC'
            entry=str(uuid.uuid4())
            require(rpc('ENTRY_CREATE',{'id':entry,'case_id':None,'kind':'EXPENSE','amount':10,
                'date':'2026-11-11','holder':'COMPANY','reference':'HTTP-FIXTURE',
                'category':'Fixture','note':'Synthetic only'},access))
            assert any(e['id']==entry for e in require(rpc('LIST',{},access))['entries'])
            assert rpc('LIST',{},anon)[0] in (401,403)
            print('AUTHENTICATED FINANCE RPC OK',flush=True)
            stage='private storage upload and authorization'
            content=b'%PDF-1.7\nSynthetic private document\n%%EOF'
            did=str(uuid.uuid4())
            doc=require(document('RESERVE',{'id':did,'entry_id':entry,'filename':'fixture.pdf',
                'mime':'application/pdf','size':len(content),'sha256':hashlib.sha256(content).hexdigest()},uid))
            path='/object/kohl-finance-documents/'+doc['object_path']
            require(http('http://storage:5000',path,service,'POST',raw=content))
            require(document('FINISH',{'id':did},uid))
            assert http('http://storage:5000',path,service)==(200,content)
            assert http('http://storage:5000',path,access)[0] in (400,401,403,404)
            assert http('http://storage:5000','/object/public/kohl-finance-documents/'+doc['object_path'])[0] in (400,401,403,404)
            result=http('http://rest:3000','/rpc/operations_document',access,'POST',{'actor':uid,'operation':'READ','payload':{'id':did}})
            assert result[0] in (401,403)
            print('PRIVATE STORAGE UPLOAD/DOWNLOAD AND DIRECT ACCESS DENIAL OK',flush=True)
            print('SERVICES TEST PASSED (synthetic data).',flush=True)
            if args.application:
                stage='application readiness'
                wait_http('http://127.0.0.1:3000','/login')
                module_spec=importlib.util.spec_from_file_location('application_fixture',ROOT/'scripts/operations-application-fixture.py')
                fixture=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(fixture)
                def application_stage(value):
                    nonlocal stage
                    stage=value
                fixture.run(http,require,sql,access,password,service,ROOT,application_stage)
                print('EXACT APPLICATION API TEST PASSED (synthetic data).',flush=True)
            else:
                print('Exact application HTTP flow not requested; use --application.',flush=True)
        except Exception as exc:
            print('STOP: services test failed at '+stage)
            print('Failure type: '+type(exc).__name__)
            for name in created:
                subprocess.run(['docker','logs','--tail','80',name],stdout=log,stderr=log)
            print('Private diagnostics: '+str(folder/'private.log')+'; do not paste raw logs.')
            raise SystemExit(1)
        finally:
            failed=[]
            for name in reversed(created):
                if subprocess.run(['docker','rm','-f','-v',name],stdout=log,stderr=log).returncode:failed.append(name)
            if volume_created:
                if subprocess.run(['docker','volume','rm',volume],stdout=log,stderr=log).returncode:failed.append(volume)
            if network_created:
                if subprocess.run(['docker','network','rm',network],stdout=log,stderr=log).returncode:failed.append(network)
            for path in folder.glob('*.env'):path.unlink()
            if failed:
                print('CLEANUP INCOMPLETE: '+', '.join(failed))
            else:
                print('Temporary test containers/storage volume/network removed; production unchanged.')

if __name__=='__main__':
    main()
