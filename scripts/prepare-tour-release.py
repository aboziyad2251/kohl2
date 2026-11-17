"""Build and test the pinned employee tour without changing live containers or SQL."""
import fcntl,importlib.util,json,os,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE='5f2ca19334e459a617b415578d47cd9cd2522583'
LIVE={'kohl_crm_app':'sha256:df561ba5ca8da66172ea97edd4390fecb9e3e0e9b6f034f68b08689f3e9ed259',
 'kohl_broker_frontend':'sha256:b15b68eb3d5127fadc97a2bc8273e1b004ff4073a8202696194912c414dab46f',
 'kohl_account_frontend':'sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850'}
spec=importlib.util.spec_from_file_location('inert_build_helpers',ROOT/'scripts/prepare-leasing-specialist-release.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
# Use its pure runtime validation and archive builder only, never its preparation,
# SQL, restore or historical release paths.
build.SOURCE=SOURCE

def checkpoint():
 originals={name:build.inspect(name) for name in LIVE}
 if any(obj['Image']!=LIVE[name] or not obj['State']['Running'] for name,obj in originals.items()):
  raise RuntimeError('Live images differ from the reviewed checkpoint')
 if build.env(originals['kohl_account_frontend']).get('PASSWORD_RECOVERY_ENABLED')!='false':
  raise RuntimeError('Account recovery must remain disabled')
 build.candidate_runtime(originals['kohl_crm_app'],LIVE['kohl_crm_app'])
 return originals

def main():
 os.umask(0o077)
 if subprocess.check_output(['git','-C',str(ROOT),'status','--porcelain','--untracked-files=no'],text=True).strip():
  raise RuntimeError('Tracked source changes require review')
 if subprocess.check_output(['git','-C',str(ROOT),'rev-parse',SOURCE+'^{commit}'],text=True).strip()!=SOURCE:
  raise RuntimeError('Pinned source unavailable')
 originals=checkpoint()
 base=Path('/home/debian/backups');base.mkdir(parents=True,exist_ok=True)
 lock=(base/'.kohl-operations-release.lock').open('a')
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 if shutil.disk_usage(base).free<4*1024**3:raise RuntimeError('At least 4 GiB disk space required')
 available=next(int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
 if available<2*1024**3:raise RuntimeError('At least 2 GiB available RAM required')
 folder=Path(tempfile.mkdtemp(prefix='kohl-tour-plan-',dir=base))
 print('Private preparation directory: '+str(folder),flush=True)
 with (folder/'private.log').open('xb') as log:
  print('Building pinned tour image; production remains running.',flush=True)
  image=build.build(folder,originals['kohl_crm_app'],log)
  print('Testing exact image with isolated synthetic identity services.',flush=True)
  receipt=folder/'http-receipt.private.json'
  subprocess.run([sys.executable,'-B',str(ROOT/'scripts/test-leasing-switch.py'),'--app-image',image,'--receipt',str(receipt)],check=True,stdout=log,stderr=log,timeout=900)
  accepted=json.loads(receipt.read_text())
  if accepted.get('passed') is not True or accepted.get('image')!=image or accepted.get('production_changed') is not False:
   raise RuntimeError('Exact image acceptance failed')
  current=checkpoint()
  for name,old in originals.items():
   now=current[name]
   if any(now[k]!=old[k] for k in ['Id','Image','Config','HostConfig','NetworkSettings']) or now['State']['StartedAt']!=old['State']['StartedAt']:
    raise RuntimeError('Live containers changed during preparation')
  candidate=build.candidate_runtime(originals['kohl_crm_app'],image)
  build.private_json(folder/'runtime-original.private.json',originals)
  build.private_json(folder/'runtime-candidate.private.json',candidate)
  build.private_json(folder/'plan.private.json',{'source':SOURCE,'image':image,'previous_images':LIVE,
    'http_receipt_sha256':build.digest(receipt),'production_changed':False,'migrations':[],
    'account_recovery_disabled':True,'hatif_matches_live':True})
 print('TOUR PREPARATION OK; Hatif preserved; recovery disabled; production unchanged.')
 print('Candidate image: '+image)
 print('Private plan directory: '+str(folder))
 print('No deployment performed. Do not share runtime JSON or private logs.')
if __name__=='__main__':
 try:main()
 except Exception as error:raise SystemExit('STOP: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__+'; inspect private preparation log'))
