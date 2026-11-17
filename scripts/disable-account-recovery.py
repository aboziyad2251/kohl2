"""Recreate the pinned account frontend with recovery disabled. Default: dry run."""
import argparse,copy,datetime,importlib.util,json,os,subprocess,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('inert_release_helpers',ROOT/'release-operations.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
NAME='kohl_account_frontend'
IMAGE='sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850'
def inspect(name):return h.api('GET','/containers/'+name+'/json')
def candidate(old):
 if old['Image']!=IMAGE or not old['State']['Running']:raise RuntimeError('Account checkpoint changed')
 new=copy.deepcopy(old)
 new['Config']['Env']=[x for x in old['Config'].get('Env',[]) if x.split('=',1)[0]!='PASSWORD_RECOVERY_ENABLED']+['PASSWORD_RECOVERY_ENABLED=false']
 return new

def public_check():
 for path in ['/api/auth/providers','/login']:
  req=urllib.request.Request('https://app.kohlestate-ksa.online'+path,headers={'Cache-Control':'no-cache'})
  with urllib.request.urlopen(req,timeout=20) as response:
   body=response.read().decode()
   if response.status!=200 or response.url!=req.full_url:raise RuntimeError('Public route changed or redirected')
   if path.endswith('providers'):
    if json.loads(body).get('recovery') is not False:raise RuntimeError('Public recovery still enabled')
    if 'no-store' not in response.headers.get('Cache-Control',''):raise RuntimeError('Provider response is cacheable')
   elif 'type="password"' not in body:raise RuntimeError('Login form unavailable')

def execute(apply):
 old=inspect(NAME);new=candidate(old)
 others={n:inspect(n) for n in ['kohl_crm_app','kohl_broker_frontend']}
 config,primary,endpoints=h.payload(new,IMAGE,'disable-recovery')
 subprocess.run(['docker','exec','nginx_proxy_manager','nginx','-t'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 if not apply:
  print('RECOVERY DRY RUN OK: pinned account image; only recovery flag changes; main/broker preserved.');return
 folder=Path('/home/debian/backups')/('kohl-recovery-disabled-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
 folder.mkdir(mode=0o700)
 h.write_private(folder/'runtime-original.private.json',old)
 print('Private checkpoint: '+str(folder),flush=True)
 release=folder.name;config['Labels']['kohl.operations.release']=release
 h.write_private(folder/'runtime-candidate.private.json',config)
 previous=NAME+'_before_'+release
 try:
  h.api('POST','/containers/'+old['Id']+'/update',{'RestartPolicy':{'Name':'no','MaximumRetryCount':0}})
  h.api('POST','/containers/'+old['Id']+'/stop?t=20')
  h.api('POST','/containers/'+old['Id']+'/rename?name='+previous)
  created=h.api('POST','/containers/create?name='+NAME,config)
  h.write_private(folder/'created.private.json',created)
  for network,endpoint in endpoints.items():
   if network!=primary:h.api('POST','/networks/'+network+'/connect',{'Container':created['Id'],'EndpointConfig':endpoint})
  h.api('POST','/containers/'+created['Id']+'/start')
  code="fetch('http://127.0.0.1:3000/api/auth/providers').then(r=>r.json()).then(v=>process.exit(v.recovery===false?0:1)).catch(()=>process.exit(1))"
  for attempt in range(30):
   r=subprocess.run(['docker','exec',created['Id'],'node','-e',code],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
   if r.returncode==0:break
   time.sleep(1)
  else:raise RuntimeError('Account provider did not become ready')
  if inspect(NAME)['Config']['Env']!=config['Env']:raise RuntimeError('Candidate environment differs')
  subprocess.run(['docker','exec','nginx_proxy_manager','nginx','-s','reload'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  public_check()
  for name,saved in others.items():
   current=inspect(name)
   if any(current[k]!=saved[k] for k in ['Id','Config','Image','HostConfig']) or not current['State']['Running'] or current['State']['StartedAt']!=saved['State']['StartedAt']:raise RuntimeError('Main/broker changed')
  h.write_private(folder/'receipt.json',{'passed':True,'recovery':False,'image':IMAGE,'main_broker_unchanged':True})
 except BaseException:
  matches=h.api('GET','/containers/json?all=true&filters='+__import__('urllib.parse',fromlist=['quote']).quote(json.dumps({'name':['^/'+NAME+'$']})))
  for entry in matches:
   current=inspect(entry['Id'])
   if current['Id']==old['Id']:continue
   if current['Config'].get('Labels',{}).get('kohl.operations.release')!=release:raise RuntimeError('Unrelated account container; manual recovery required')
   h.api('DELETE','/containers/'+current['Id']+'?force=true')
  saved=inspect(old['Id'])
  if saved['Name']!='/'+NAME:h.api('POST','/containers/'+old['Id']+'/rename?name='+NAME)
  h.api('POST','/containers/'+old['Id']+'/update',{'RestartPolicy':old['HostConfig']['RestartPolicy']})
  if not inspect(old['Id'])['State']['Running']:h.api('POST','/containers/'+old['Id']+'/start')
  subprocess.run(['docker','exec','nginx_proxy_manager','nginx','-s','reload'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  raise RuntimeError('Change failed; previous account frontend restored (recovery may still be enabled)') from None
 print('RECOVERY DISABLED: fresh account process; public recovery=false; login 200 without redirect; main/broker unchanged.')
 print('No external CDN purge claimed. Reload the recovery page and verify English unavailable state.')
if __name__=='__main__':
 os.umask(0o077)
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 try:
  with h.release_lock():execute(args.apply)
 except Exception as error:raise SystemExit('STOP: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__))
