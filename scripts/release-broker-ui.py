"""Stage/build or deploy the approved three-file broker UI patch over live source.

Run on the VPS with an adjacent broker-ui-payload.zip. No database/Auth writes.
Private receipts retain runtime settings; never copy them into Git.
"""
import copy,datetime,hashlib,http.client,json,os,pathlib,shutil,socket,subprocess,sys,time,urllib.request,urllib.error,zipfile
os.umask(0o077)
live=pathlib.Path('/home/debian/projects/kohl-crm-app')
stage=pathlib.Path('/home/debian/projects/kohl-broker-ui-release-20261108')
image='kohl-broker-ui:20261108'
files=['app/globals.css','components/portal/BrokerPanel.tsx','components/portal/PortalDashboard.tsx']
def inspect(name):return json.loads(subprocess.check_output(['docker','inspect',name]))[0]
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
class Engine(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.connect('/var/run/docker.sock')
def api(method,path,body=None):
 conn=Engine('localhost',timeout=60);conn.request(method,'/v1.41'+path,json.dumps(body) if body is not None else None,{'Content-Type':'application/json'});response=conn.getresponse();data=response.read();conn.close()
 assert response.status<300,'Docker operation failed: '+method+' '+path
 return json.loads(data) if data else None
def create(name,old,new_image,preview=False):
 config=copy.deepcopy(old['Config']);config['Image']=new_image
 host=copy.deepcopy(old['HostConfig'])
 if preview:
  host['PortBindings']={'3000/tcp':[{'HostIp':'127.0.0.1','HostPort':'39180'}]};host['RestartPolicy']={'Name':'no','MaximumRetryCount':0}
 config['HostConfig']=host
 config['NetworkingConfig']={'EndpointsConfig':{network:{'Aliases':(entry.get('Aliases') or []) if not preview else [name]} for network,entry in old['NetworkSettings']['Networks'].items()}}
 result=api('POST','/containers/create?name='+name,config);api('POST','/containers/'+result['Id']+'/start');return result['Id']
def ready(base):
 for attempt in range(40):
  try:
   if urllib.request.urlopen(base+'/login',timeout=3).status==200:return
  except Exception:pass
  time.sleep(1)
 raise RuntimeError('Application did not become ready')
def checks(base):
 for path in ['/login','/portal','/bills-forms/broker-cooperation','/brokerage-agreements']:
  assert urllib.request.urlopen(base+path,timeout=15).status==200
 assert json.load(urllib.request.urlopen(base+'/api/auth/providers',timeout=15))=={'google':True,'recovery':False}
 for path in ['/api/portal/dashboard','/api/access/users','/api/portal/attention']:
  try:urllib.request.urlopen(base+path,timeout=15);raise AssertionError('Signed-out API was allowed')
  except urllib.error.HTTPError as error:assert error.code==401
if sys.argv[1]=='build':
 assert not stage.exists(),'Stage already exists; inspect before reuse'
 old=inspect('kohl_crm_app');stage.mkdir(mode=0o700)
 shutil.copytree(live,stage,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.git','node_modules','.next*','.env*','.portal-stage','backups','tmp'))
 payload=pathlib.Path(__file__).with_name('broker-ui-payload.zip')
 with zipfile.ZipFile(payload) as archive:
  manifest=json.loads(archive.read('manifest.json'))
  for name in files:
   assert digest(live/name)==manifest[name],'Live source changed: '+name
   (stage/name).write_bytes(archive.read(name))
 env=dict(item.split('=',1) for item in old['Config']['Env'])
 with (stage/'build.log').open('wb') as log:
  result=subprocess.run(['docker','build','-f','Dockerfile.next','-t',image,'--build-arg','NEXT_PUBLIC_SUPABASE_URL='+env['NEXT_PUBLIC_SUPABASE_URL'],'--build-arg','NEXT_PUBLIC_SUPABASE_ANON_KEY='+env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],'.'],cwd=stage,stdout=log,stderr=subprocess.STDOUT)
 assert result.returncode==0,'Build failed; inspect private build.log'
 receipt={'image':image,'image_id':inspect(image)['Id'],'previous_image':old['Image'],'source_before':manifest,'source_after':{name:digest(stage/name) for name in files}}
 (stage/'build.json').write_text(json.dumps(receipt));create('kohl_broker_ui_preview',old,receipt['image_id'],True);ready('http://127.0.0.1:39180');checks('http://127.0.0.1:39180')
 print('Built and preview smoke checks passed: '+receipt['image_id'])
elif sys.argv[1]=='deploy':
 receipt=json.loads((stage/'build.json').read_text());accepted=json.loads((stage/'browser-acceptance.json').read_text())
 assert accepted['passed'] and accepted['image_id']==receipt['image_id']
 old=inspect('kohl_crm_app');assert old['Image']==receipt['previous_image'],'Live image changed'
 for name in files:
  assert digest(live/name)==receipt['source_before'][name] and digest(stage/name)==receipt['source_after'][name],'Source drift: '+name
 backup=pathlib.Path('/home/debian/backups')/('kohl-broker-ui-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'));backup.mkdir(mode=0o700)
 (backup/'container-before.json').write_text(json.dumps(old))
 with (backup/'backup.log').open('wb') as log:
  result=subprocess.run(['tar','-czf',str(backup/'source-before.tgz'),'--exclude=.git','--exclude=node_modules','--exclude=.next*','--exclude=.portal-stage','--exclude=backups','--exclude=tmp','-C',str(live),'.'],stdout=log,stderr=subprocess.STDOUT)
  assert result.returncode==0
 for name in files:
  target=backup/'source'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(live/name,target)
 old_name='kohl_crm_app_before_broker_'+backup.name.rsplit('-',1)[-1]
 changed=False;renamed=False
 try:
  for name in files:shutil.copy2(stage/name,live/name)
  api('POST','/containers/kohl_crm_app/stop?t=15');api('POST','/containers/kohl_crm_app/rename?name='+old_name);renamed=True
  create('kohl_crm_app',old,receipt['image_id']);changed=True;ready('http://127.0.0.1:3020')
  current=inspect('kohl_crm_app');assert current['Image']==receipt['image_id']
  assert sorted(current['Config']['Env'])==sorted(old['Config']['Env']),'Runtime environment drift'
  assert set(current['NetworkSettings']['Networks'])==set(old['NetworkSettings']['Networks'])
  assert current['HostConfig']['PortBindings']==old['HostConfig']['PortBindings']
  checks('http://127.0.0.1:3020');checks('https://app.kohlestate-ksa.online')
 except Exception:
  if renamed:
   try:api('DELETE','/containers/kohl_crm_app?force=1')
   except Exception:pass
   api('POST','/containers/'+old_name+'/rename?name=kohl_crm_app');api('POST','/containers/kohl_crm_app/start')
  else:
   try:api('POST','/containers/kohl_crm_app/start')
   except Exception:pass
  for name in files:shutil.copy2(backup/'source'/name,live/name)
  raise RuntimeError('Deployment failed; restored source and previous container') from None
 checkpoint={**receipt,'backup':str(backup),'previous_container':old_name,'runtime_unchanged':True,'database_auth_unchanged':True,'passed':True}
 (backup/'checkpoint.json').write_text(json.dumps(checkpoint));(stage/'deployment.json').write_text(json.dumps(checkpoint))
 api('DELETE','/containers/kohl_broker_ui_preview?force=1')
 print('DEPLOYED '+receipt['image_id']);print('Private rollback checkpoint: '+str(backup))
else:raise ValueError('Use build or deploy')
