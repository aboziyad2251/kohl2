"""Preview or cut over the approved additive payout release; preserve runtime/Auth/proxy."""
import copy,datetime,hashlib,http.server,json,os,pathlib,re,subprocess,sys,time,urllib.request,urllib.error
os.umask(0o077)
stage=pathlib.Path('/home/debian/projects/kohl-payout-release-20261109')
built=json.loads((stage/'build.json').read_text())
runtime={}
exec(compile(pathlib.Path('/home/debian/projects/release-broker-ui.py').read_text().split("if sys.argv[1]=='build':")[0],'runtime','exec'),runtime)
api,inspect=runtime['api'],runtime['inspect']
def preview(kind):
 network='kohl_payout_review'
 if subprocess.run(['docker','network','inspect',network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:api('POST','/networks/create',{'Name':network,'Internal':True})
 name='kohl_payout_'+kind+'_preview'
 config={'Image':built[kind]['image_id'],'Env':['NODE_ENV=production','PORT=3000','HOSTNAME=0.0.0.0','GOOGLE_LOGIN_ENABLED=true','PASSWORD_RECOVERY_ENABLED=true'],'ExposedPorts':{'3000/tcp':{}},'HostConfig':{'NetworkMode':network,'RestartPolicy':{'Name':'no'}},'NetworkingConfig':{'EndpointsConfig':{network:{}}}}
 obj=api('POST','/containers/create?name='+name,config);api('POST','/containers/'+obj['Id']+'/start')
 ip=inspect(name)['NetworkSettings']['Networks'][network]['IPAddress'];runtime['ready']('http://'+ip+':3000')
 return 'http://'+ip+':3000'
class Gateway(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  path=self.path;plain=path.split('?')[0]
  if plain=='/portal' and self.headers.get('RSC')=='1':self.send_response(409);self.end_headers();return
  upstream=self.server.broker if plain=='/portal' or path.startswith('/__broker_ui/_next/static/') else self.server.main
  if path.startswith('/__broker_ui/'):path=path[len('/__broker_ui'):]
  request=urllib.request.Request(upstream+path,headers={k:v for k,v in self.headers.items() if k.lower() not in ['host','connection']})
  try:response=urllib.request.urlopen(request,timeout=20)
  except urllib.error.HTTPError as e:response=e
  body=response.read();self.send_response(response.status)
  for k,v in response.headers.items():
   if k.lower() not in ['transfer-encoding','connection','content-length']:self.send_header(k,v)
  self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
def db(query):
 result=subprocess.run(['docker','exec','-i','supabase-db','psql','-U','supabase_admin','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],input=query.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if result.returncode:
  (stage/'database-error.private.log').write_bytes(result.stderr)
  raise RuntimeError('Database action failed; inspect private release log')
 return result.stdout.decode().strip()
def live_checks():
 base='https://app.kohlestate-ksa.online'
 for path in ['/login','/today','/calendar','/audit','/activity','/settings','/financials/daily-reports','/bills-forms','/portal']:
  assert urllib.request.urlopen(base+path,timeout=20).status==200,path
 assert json.load(urllib.request.urlopen(base+'/api/auth/providers'))=={'google':True,'recovery':True}
 for path in ['/api/portal/payout-requests','/api/portal/dashboard','/api/access/users']:
  try:urllib.request.urlopen(base+path,timeout=20);raise AssertionError('Anonymous API allowed')
  except urllib.error.HTTPError as e:assert e.code==401
 portal=urllib.request.urlopen(base+'/portal').read().decode()
 assets=re.findall(r'(?:src|href)="([^" ]*__broker_ui/_next/static/[^" ]+)"',portal);assert assets
 for asset in assets:assert urllib.request.urlopen(base+asset,timeout=20).status==200
 assert '/__account_ui/' in urllib.request.urlopen(base+'/auth/forgot-password').read().decode()
if sys.argv[1]=='preview':
 main=preview('main');broker=preview('broker')
 for kind in ['main','broker']:
  manifest=json.loads(subprocess.check_output(['docker','exec','kohl_payout_'+kind+'_preview','cat','/app/.next/server/app-paths-manifest.json']))
  baseline=json.loads((stage/'source/docs/baselines/production-20261109-routes.json').read_text(encoding='utf-8-sig'))
  assert all(route in manifest for route in baseline)
  assert '/api/portal/payout-requests/route' in manifest
 (stage/'preview.json').write_text(json.dumps({'main':main,'broker':broker,'images':built}))
 print('CANDIDATE_PREVIEWS_READY=True')
elif sys.argv[1]=='serve':
 preview_data=json.loads((stage/'preview.json').read_text());server=http.server.ThreadingHTTPServer(('127.0.0.1',39186),Gateway)
 server.main=preview_data['main'];server.broker=preview_data['broker'];print('CANDIDATE_GATEWAY_READY=True',flush=True);server.serve_forever()
elif sys.argv[1]=='deploy':
 accepted=json.loads((stage/'acceptance.json').read_text());assert accepted['passed'] and accepted['images']==built and accepted['production_approved']
 auth_before=inspect('supabase-auth')['Id']
 proxy_before=subprocess.check_output(['docker','exec','nginx_proxy_manager','cat','/data/nginx/proxy_host/8.conf'])
 old=inspect('kohl_crm_app');broker=inspect('kohl_broker_frontend');account=inspect('kohl_account_frontend')
 assert old['Image']==built['previous_main'] and broker['Image']=='sha256:223b615202c1e8553c15b60c59d75e3079acd72f28c0f1a256ef4544960a76a6'
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 backup=pathlib.Path('/home/debian/backups')/('kohl-payout-'+stamp);backup.mkdir(mode=0o700)
 for name,obj in [('main',old),('broker',broker),('account',account)]: (backup/(name+'-before.private.json')).write_text(json.dumps(obj))
 assert db("select to_regclass('portal_private.broker_payout_requests') is null")=='t'
 with (backup/'postgres-before.dump').open('wb') as stream:
  subprocess.run(['docker','exec','supabase-db','pg_dump','-U','supabase_admin','-d','postgres','-Fc'],stdout=stream,stderr=subprocess.PIPE,check=True)
 with (backup/'postgres-before.dump').open('rb') as stream:
  subprocess.run(['docker','exec','-i','supabase-db','pg_restore','--list'],stdin=stream,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=True)
 migration=(stage/'source/supabase/migrations/20261109003906_broker_payout_requests.sql').read_text()
 assert hashlib.sha256(migration.encode()).hexdigest()==accepted['migration_sha256']
 body=migration.replace('\nbegin;\n','\n',1);body=re.sub(r'\ncommit;\s*\Z','\n',body)
 assert body!=migration
 transaction="begin;select pg_advisory_xact_lock(hashtext('kohl-payout-release'));"+body+'commit;'
 db(transaction)
 checks=db("select json_build_object('rls',(select relrowsecurity from pg_class where oid='portal_private.broker_payout_requests'::regclass),'raw_read_denied',not has_table_privilege('authenticated','portal_private.broker_payout_requests','SELECT'),'anon_execute_denied',not has_function_privilege('anon','public.broker_payout_requests(text,jsonb)','EXECUTE'),'authenticated_execute',has_function_privilege('authenticated','public.broker_payout_requests(text,jsonb)','EXECUTE'))")
 assert all(json.loads(checks).values())
 (backup/'migration.json').write_text(json.dumps({'version':'20261109003906','sha256':hashlib.sha256(migration.encode()).hexdigest(),'checks':json.loads(checks)}))
 originals={'kohl_crm_app':old,'kohl_broker_frontend':broker};swapped=[]
 try:
  for name,kind in [('kohl_crm_app','main'),('kohl_broker_frontend','broker')]:
   previous=name+'_before_payout_'+stamp
   api('POST','/containers/'+name+'/stop?t=20');api('POST','/containers/'+name+'/rename?name='+previous)
   swapped.append((name,previous))
   runtime['create'](name,originals[name],built[kind]['image_id'],False)
   assert inspect(name)['Config']['Env']==originals[name]['Config']['Env']
  subprocess.run(['docker','exec','nginx_proxy_manager','nginx','-t'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  subprocess.run(['docker','exec','nginx_proxy_manager','nginx','-s','reload'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  for _ in range(30):
   try:live_checks();break
   except Exception:time.sleep(1)
  else:raise RuntimeError('Public acceptance failed')
  assert inspect('kohl_account_frontend')['Image']==account['Image']
  assert inspect('supabase-auth')['Id']==auth_before
  assert subprocess.check_output(['docker','exec','nginx_proxy_manager','cat','/data/nginx/proxy_host/8.conf'])==proxy_before
 except Exception:
  for name,previous in reversed(swapped):
   if subprocess.run(['docker','inspect',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:api('DELETE','/containers/'+name+'?force=true')
   api('POST','/containers/'+previous+'/rename?name='+name);api('POST','/containers/'+name+'/start')
  subprocess.run(['docker','exec','nginx_proxy_manager','nginx','-s','reload'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  raise RuntimeError('App rollback completed; additive request schema retained to preserve any requests') from None
 receipt={**built,'backup':str(backup),'migration':'20261109003906','account_image_preserved':account['Image'],'runtime_preserved':True,'proxy_configuration_unchanged':True,'requests_after_cutover':int(db('select count(*) from portal_private.broker_payout_requests'))}
 (stage/'deployment.json').write_text(json.dumps(receipt));(backup/'release.json').write_text(json.dumps(receipt));print('PAYOUT_RELEASE_DEPLOYED=True');print('BACKUP='+str(backup))
else:raise ValueError('Use preview, serve or deploy')
