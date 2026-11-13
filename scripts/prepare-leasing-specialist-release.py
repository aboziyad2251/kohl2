"""Build/test/backup/offline rehearsal for the leasing account. No production apply path.
Production SQL is read-only. Restore and migration writes require an isolated container.
"""
import argparse
import ast
import base64
import copy
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parent.parent
SOURCE='6b0fcb4db8c19d7334e8a29b22ec7f3b0e601241'
MIGRATION='20261113202336_leasing_specialist_account.sql'
HASH='cb4bacafb2bde3d852dbda1f0fbc6c2db3bcaa8b460d43aa950aae12d5842c17'
BACKUPS=Path('/home/debian/backups')
HATIF=Path('/home/debian/.config/kohl/hatif.env')

def load(name,filename):
 spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/filename)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
restore=load('leasing_offline_restore','rehearse-operations-restore.py')
pre=load('leasing_read_only_preflight','preflight-leasing-specialist.py')
LIVE=pre.LIVE

def digest(path):
 value=hashlib.sha256()
 with path.open('rb') as stream:
  for block in iter(lambda:stream.read(1024*1024),b''):value.update(block)
 return value.hexdigest()
def private_json(path,data):
 with path.open('x') as stream:
  os.fchmod(stream.fileno(),0o600);json.dump(data,stream,indent=2)
def inspect(name,image=False):return json.loads(pre.output(['docker',*(['image'] if image else []),'inspect',name]))[0]
def env(obj):return dict(v.split('=',1) for v in obj['Config'].get('Env',[]) if '=' in v)
def candidate_runtime(original,image):
 source=(ROOT/'scripts/release-broker-ui.py').read_text()
 node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='prepare_hatif_runtime')
 scope={'copy':copy,'pathlib':__import__('pathlib')}
 exec(compile(ast.Module(body=[node],type_ignores=[]),'pure-hatif-preflight','exec'),scope)
 candidate=scope['prepare_hatif_runtime'](original,HATIF)
 if env(candidate)!=env(original):raise RuntimeError('Private Hatif reconciliation required')
 if original.get('Mounts') or original['Config'].get('Volumes') or original['HostConfig'].get('AutoRemove'):
  raise RuntimeError('Main mounts/volumes/auto-remove require review')
 candidate['Config']['Image']=image
 return candidate

def check_live():
 originals={name:inspect(name) for name in LIVE}
 if any(obj['Image']!=LIVE[name] or not obj['State']['Running'] for name,obj in originals.items()):
  raise RuntimeError('Live checkpoint changed')
 if inspect('supabase-db')['Image']!=restore.IMAGE:raise RuntimeError('Database image changed')
 candidate_runtime(originals['kohl_crm_app'],LIVE['kohl_crm_app'])
 return originals

def preflight(name,log):
 flags=json.loads(restore.query(name,pre.SQL,log))
 if not flags or any(v is not True for v in flags.values()):raise RuntimeError('Database prerequisites differ')

def isolated_only(name):
 if not re.fullmatch(r'kohl_restore_review_[0-9a-f]{12}',name):raise RuntimeError('Writes require a disposable restore container')

def snapshot(name,log):
 tables={'portal_private':['accounts','leasing_units','leasing_cases','leasing_followups','internal_dues','internal_installments','internal_entries','operations_documents','operations_history','operations_replays','operations_exports','operations_approval_config'],
         'auth':['users','sessions'],'public':['crm_leads','properties','contracts']}
 result={}
 for schema,names in tables.items():
  for table in names:
   row="to_jsonb(t)-'assistant_enabled'" if table=='operations_approval_config' else 'to_jsonb(t)'
   statement=f"BEGIN READ ONLY; SET LOCAL statement_timeout='30s'; SELECT md5(coalesce(jsonb_agg({row} ORDER BY ({row})::text)::text,'[]')) FROM {schema}.{table} t; ROLLBACK;"
   result[schema+'.'+table]=restore.query(name,statement,log)
 return result

VERIFY="""BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT
 EXISTS(SELECT 1 FROM pg_roles WHERE rolname='kohl_leasing' AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreaterole)
 AND NOT pg_has_role('kohl_leasing','authenticated','MEMBER')
 AND NOT has_schema_privilege('kohl_leasing','portal_private','USAGE')
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','portal_private','auth','storage') AND c.relkind IN ('r','p','v','m')
  AND has_table_privilege('kohl_leasing',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prosecdef AND p.proname NOT IN ('leasing_profile','leasing_operations')
  AND has_function_privilege('kohl_leasing',p.oid,'EXECUTE'))
 AND has_function_privilege('kohl_leasing','public.leasing_profile()','EXECUTE')
 AND has_function_privilege('kohl_leasing','public.leasing_operations(text,jsonb)','EXECUTE')
 AND NOT has_function_privilege('kohl_leasing','public.kohl_operations(text,jsonb)','EXECUTE')
 AND NOT has_function_privilege('kohl_leasing','public.operations_document(uuid,text,jsonb)','EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM (VALUES ('anon'),('authenticated'),('service_role')) x(role)
  WHERE has_function_privilege(x.role,'public.leasing_profile()','EXECUTE')
   OR has_function_privilege(x.role,'public.leasing_operations(text,jsonb)','EXECUTE'))
 AND NOT EXISTS(SELECT 1 FROM (VALUES ('anon'),('authenticated'),('service_role'),('kohl_leasing')) x(role)
  WHERE has_function_privilege(x.role,'portal_private.leasing_core_v1(text,jsonb)','EXECUTE')
   OR has_function_privilege(x.role,'portal_private.leasing_scope()','EXECUTE'))
 AND has_function_privilege('service_role','public.leasing_switch_admin(uuid,text,jsonb)','EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM (VALUES ('anon'),('authenticated'),('kohl_leasing')) x(role)
  WHERE has_function_privilege(x.role,'public.leasing_switch_admin(uuid,text,jsonb)','EXECUTE'))
 AND NOT EXISTS(SELECT 1 FROM pg_class WHERE oid IN ('portal_private.leasing_specialist_config'::regclass,
  'portal_private.leasing_delegations'::regclass,'portal_private.leasing_specialist_leads'::regclass) AND NOT relrowsecurity)
 AND EXISTS(SELECT 1 FROM portal_private.leasing_specialist_config WHERE singleton AND specialist_id IS NULL AND enabled)
 AND NOT EXISTS(SELECT 1 FROM portal_private.leasing_delegations)
 AND NOT EXISTS(SELECT 1 FROM portal_private.leasing_specialist_leads)
 AND EXISTS(SELECT 1 FROM portal_private.operations_approval_config c
  JOIN portal_private.accounts m ON m.user_id=c.manager_id AND m.role='ADMIN' AND m.is_active
  JOIN portal_private.accounts f ON f.user_id=c.final_id AND f.role='CEO' AND f.is_active
  WHERE c.singleton AND NOT c.assistant_enabled);
ROLLBACK;"""

def verify(name,log):
 isolated_only(name)
 restore.verify(name,log)
 if restore.query(name,VERIFY,log)!='t':raise RuntimeError('Leasing role, initial state or private scope differs')

def rehearse(name,archive,roles,content,log):
 isolated_only(name)
 if hashlib.sha256(content.encode()).hexdigest()!=HASH:raise RuntimeError('Migration differs')
 restore.query(name,roles,log);restore.restore(name,archive,log)
 print('ISOLATED RESTORE OK',flush=True)
 preflight(name,log);before=snapshot(name,log)
 restore.query(name,"SET statement_timeout='60s';\n"+content,log)
 verify(name,log)
 if snapshot(name,log)!=before:raise RuntimeError('Existing data or assignments changed')
 print('ISOLATED LEASING MIGRATION, PRIVILEGES AND EXISTING DATA OK',flush=True)
 return before

def build(folder,original,log):
 values=env(original)
 for key in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'):
  if not values.get(key):raise RuntimeError('Public build settings missing')
 # Refuse a service key accidentally placed in a browser build variable.
 key=values['NEXT_PUBLIC_SUPABASE_ANON_KEY']
 try: role=json.loads(base64.urlsafe_b64decode(key.split('.')[1]+'==='))['role']
 except (ValueError,KeyError,IndexError):raise RuntimeError('Expected existing anon JWT configuration')
 if role!='anon':raise RuntimeError('Public build key is not anonymous')
 archive=folder/'source.tar'
 with archive.open('xb') as stream:
  restore.run(['git','-C',str(ROOT),'archive','--format=tar',SOURCE],log,stdout=stream)
 source=folder/'source';source.mkdir(mode=0o700)
 restore.run(['tar','-xf',str(archive),'-C',str(source)],log,stdout=log)
 if any(p.name not in ('.env.example','.env.local.example') for p in source.glob('.env*')):
  raise RuntimeError('Unexpected environment file in pinned source')
 tag='kohl-leasing-review:'+SOURCE[:12]
 command=['docker','build','-f','Dockerfile.next','-t',tag,'--label','org.opencontainers.image.revision='+SOURCE]
 for key in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'):command+=['--build-arg',key+'='+values[key]]
 restore.run(command+['.'],log,cwd=source,stdout=log)
 image=inspect(tag,True)['Id']
 shutil.rmtree(source);archive.unlink()
 return image

def prepare(args):
 os.umask(0o077)
 if pre.output(['git','-C',str(ROOT),'status','--porcelain','--untracked-files=no']):raise RuntimeError('Tracked source changes require review')
 content=(ROOT/'supabase/migrations'/MIGRATION).read_text()
 if hashlib.sha256(content.encode()).hexdigest()!=HASH:raise RuntimeError('Candidate migration differs')
 originals=check_live()
 BACKUPS.mkdir(parents=True,exist_ok=True)
 if shutil.disk_usage(BACKUPS).free<4*1024**3:raise RuntimeError('At least 4 GiB free disk required')
 available=next(int(x.split()[1])*1024 for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:'))
 if available<2*1024**3:raise RuntimeError('At least 2 GiB available RAM required')
 with (BACKUPS/'.leasing-preparation.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  folder=Path(tempfile.mkdtemp(prefix='kohl-leasing-plan-',dir=BACKUPS));stage='read-only preflight'
  try:
   with (folder/'private.log').open('xb') as log:
    preflight('supabase-db',log)
    stage='pinned build';print('BUILDING PINNED LEASING IMAGE; live app remains running.',flush=True)
    image=args.app_image or build(folder,originals['kohl_crm_app'],log)
    if not re.fullmatch(r'sha256:[0-9a-f]{64}',image):raise RuntimeError('Exact image required')
    built=inspect(image,True)
    if built['Id']!=image or (built['Config'].get('Labels') or {}).get('org.opencontainers.image.revision')!=SOURCE:
     raise RuntimeError('Candidate image source differs')
    print('BUILD OK: '+image,flush=True)
    stage='exact-image synthetic authentication test'
    subprocess.run([sys.executable,'-B',str(ROOT/'scripts/test-leasing-switch.py'),'--app-image',image,'--receipt',str(folder/'http-receipt.private.json')],check=True)
    receipt=json.loads((folder/'http-receipt.private.json').read_text())
    if receipt.get('image')!=image or receipt.get('passed') is not True or receipt.get('migration_sha256')!=HASH or receipt.get('production_changed') is not False or receipt.get('test_script_sha256')!=digest(ROOT/'scripts/test-leasing-switch.py'):
     raise RuntimeError('HTTP acceptance receipt differs')
    runtime=candidate_runtime(originals['kohl_crm_app'],image)
    stage='fresh backup'
    size=int(restore.query('supabase-db',"BEGIN READ ONLY; SELECT pg_database_size(current_database()); ROLLBACK;",log))
    if shutil.disk_usage(BACKUPS).free<size*2+2*1024**3:raise RuntimeError('Insufficient backup/restore disk')
    roles=restore.query('supabase-db',restore.ROLE_SQL,log)
    partial=folder/'postgres.dump.incomplete'
    with partial.open('xb') as stream:
     restore.run(['docker','exec','supabase-db','pg_dump','-U','postgres','-Fc','--lock-wait-timeout=15s','postgres'],log,stdout=stream)
    if not partial.stat().st_size:raise RuntimeError('Empty backup')
    with partial.open('rb') as stream:
     restore.run(['docker','exec','-i','supabase-db','pg_restore','--list'],log,stdin=stream,stdout=log)
    archive=folder/'postgres.dump';partial.rename(archive);print('FRESH PRIVATE BACKUP ARCHIVE OK',flush=True)
    stage='offline restore rehearsal'
    with restore.sandbox(restore.IMAGE,log) as name:fingerprints=rehearse(name,archive,roles,content,log)
    stage='runtime and Hatif recheck'
    for name,original in originals.items():
     current=inspect(name)
     if any(current[k]!=original[k] for k in ('Id','Image','Config','HostConfig','NetworkSettings')) or not current['State']['Running'] or current['State']['StartedAt']!=original['State']['StartedAt']:
      raise RuntimeError('Live runtime changed during preparation')
    if candidate_runtime(inspect('kohl_crm_app'),image)!=runtime:raise RuntimeError('Hatif/runtime changed')
    private_json(folder/'runtime-original.private.json',originals)
    private_json(folder/'runtime-candidate.private.json',runtime)
    private_json(folder/'plan.private.json',{'mode':'PREPARE_ONLY','application_source':SOURCE,'image':image,
     'migration':MIGRATION,'migration_sha256':HASH,'previous_images':LIVE,'database_image':restore.IMAGE,
     'backup':str(archive),'backup_sha256':digest(archive),'rehearsal_fingerprints':fingerprints,
     'http_receipt_sha256':digest(folder/'http-receipt.private.json'),'hatif_file_matches_live':True,
     'production_changed':False,'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
     'fresh_backup_required_at_cutover':True,'cutover_dispatcher':'Not included; do not use a historical dispatcher'})
   print('LEASING PREPARATION OK; Hatif preserved; production unchanged.',flush=True)
   print('Candidate image: '+image);print('Private plan directory: '+str(folder))
   print('Do not share backups, runtime/plan JSON or private logs.')
  except Exception:
   print('STOP: leasing preparation failed at '+stage)
   print('Private diagnostics: '+str(folder/'private.log')+'; do not paste raw logs.')
   raise

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--app-image',help='Reuse an image with the pinned source label; always retest it')
 args=parser.parse_args()
 try:prepare(args)
 except Exception as error:
  print('No production migration or cutover performed. Failure type: '+type(error).__name__)
  raise SystemExit(1)
if __name__=='__main__':main()
