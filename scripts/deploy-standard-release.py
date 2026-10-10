"""Deploy only the isolated-accepted Bills image/migration; preserve live source and secrets."""
import datetime,hashlib,json,os,pathlib,shutil,subprocess,time,urllib.request,urllib.error
os.umask(0o077)
stage=pathlib.Path('/home/debian/projects/kohl-standard-release-20261010');live=pathlib.Path('/home/debian/projects/kohl-crm-app')
built=json.loads((stage/'standard-build.json').read_text());accepted=json.loads((stage/'standard-acceptance.json').read_text())
assert accepted['passed'] and accepted['image_id']==built['image_id'] and accepted['migration_sha']==built['migration_sha']
migration=stage/'supabase/migrations/20261009235815_standard_forms.sql'
assert hashlib.sha256(migration.read_bytes()).hexdigest()==built['migration_sha']
files=json.loads((stage/'standard-source-files.json').read_text())
for f,h in built['source_before'].items():
 p=live/f
 assert (hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None)==h,'Production source changed since staging: '+f
old=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
assert old['Image']==built['previous_image'],'Production image changed since staging'
backup=pathlib.Path('/home/debian/backups')/('kohl-standard-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
def run(command,payload=None,cwd=None):
 result=subprocess.run(command,input=payload,capture_output=True,cwd=cwd)
 with (backup/'operations.log').open('ab') as log:log.write(result.stdout+result.stderr)
 assert result.returncode==0,'Operation failed; see private operations.log'
 return result.stdout

def sql(query,database='postgres'):
 return run(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin','-d',database,'-At','-v','ON_ERROR_STOP=1'],query.encode()).decode().strip()
schema_exists=sql("select to_regclass('portal_private.bill_forms') is not null and to_regclass('portal_private.bill_counters') is not null and to_regprocedure('public.issue_standard_form(uuid,jsonb)') is not null")=='t'
assert not schema_exists,'New standard RPC already exists; inspect its receipt before any repeat installation'
shutil.copy2(live/'.env',backup/'app.env.before')
run(['tar','-czf',str(backup/'source-before.tgz'),'--exclude=.git','--exclude=node_modules','--exclude=.next','--exclude=.portal-stage','--exclude=backups','--exclude=tmp','-C',str(live),'.'])
(backup/'git-status.txt').write_bytes(run(['git','-C',str(live),'status','--short']))
(backup/'git-diff.patch').write_bytes(run(['git','-C',str(live),'diff','--binary']))
with (backup/'postgres-before.dump').open('wb') as out:
 result=subprocess.run(['docker','exec','supabase-db','pg_dump','-U','supabase_admin','-d','postgres','-Fc'],stdout=out,stderr=subprocess.PIPE)
 assert result.returncode==0,'Final database backup failed'
restore_db='kohl_standard_restore_20261010'
assert sql("select count(*) from pg_database where datname='"+restore_db+"'")=='0'
run(['docker','exec','supabase-db','createdb','-U','supabase_admin',restore_db])
try:
 with (backup/'postgres-before.dump').open('rb') as data:
  result=subprocess.run(['docker','exec','-i','supabase-db','pg_restore','-U','supabase_admin','-d',restore_db,'--exit-on-error'],stdin=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
  with (backup/'restore-check.log').open('wb') as log:log.write(result.stdout+result.stderr)
  assert result.returncode==0,'Final backup restore failed'
 assert sql("select to_regclass('portal_private.accounts') is not null and to_regprocedure('public.portal_me()') is not null",restore_db)=='t'
finally:
 assert restore_db.startswith('kohl_standard_restore_') and restore_db!='postgres'
 run(['docker','exec','supabase-db','dropdb','-U','supabase_admin','--force',restore_db])
print('Final private database backup restored successfully',flush=True)
existing=[]
for name in files:
 assert not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts and not name.startswith('.env')
 source=live/name
 if source.exists():
  existing.append(name);saved=backup/'source'/name;saved.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,saved)
override=backup/'app-image-override.json';rollback=backup/'rollback-image.json'
override.write_text(json.dumps({'services':{'kohl_crm_app':{'image':built['image_id']}}}))
rollback.write_text(json.dumps({'services':{'kohl_crm_app':{'image':old['Image']}}}))
def restart(config):
 run(['docker','compose','--env-file','.env','-f','docker-compose.next.yml','-f',str(config),'up','-d','--no-build','--no-deps','kohl_crm_app'],cwd=live)
# Migration is additive. On application rollback retain the schema/data; never overwrite user changes with a database restore.
applied=False
try:
 if not schema_exists:sql(migration.read_text(encoding='utf-8-sig'))
 applied=True
 sql("notify pgrst, 'reload schema';")
 assert sql("select count(*) from pg_class where oid in ('portal_private.bill_forms'::regclass,'portal_private.bill_counters'::regclass) and relrowsecurity")=='2'
 assert sql("select has_function_privilege('authenticated','public.issue_standard_form(uuid,jsonb)','EXECUTE') and not has_function_privilege('anon','public.issue_standard_form(uuid,jsonb)','EXECUTE') and not has_table_privilege('authenticated','portal_private.bill_forms','SELECT')")=='t'
 (backup/'migration-receipt.json').write_text(json.dumps({'version':'20261009235815','sha256':built['migration_sha'],'applied':True,'approved':True}))
 for name in files:
  (live/name).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(stage/name,live/name)
 restart(override)
 for _ in range(40):
  try:
   if urllib.request.urlopen('http://127.0.0.1:3020/login',timeout=3).status==200:break
  except Exception:pass
  time.sleep(1)
 else:raise AssertionError('App did not become ready')
 current=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
 assert current['Image']==built['image_id']
 before=dict(x.split('=',1) for x in old['Config']['Env']);after=dict(x.split('=',1) for x in current['Config']['Env'])
 assert before==after,'Runtime configuration changed'
 for base in ['http://127.0.0.1:3020','https://app.kohlestate-ksa.online']:
  assert urllib.request.urlopen(base+'/bills-forms',timeout=10).status==200
  providers=json.load(urllib.request.urlopen(base+'/api/auth/providers',timeout=10));assert providers=={'google':True,'recovery':False}
  assert urllib.request.urlopen(base+'/auth/forgot-password',timeout=10).status==200
  for route in ['/api/portal/attention','/api/access/users','/api/portal/dashboard']:
   try:urllib.request.urlopen(base+route,timeout=10);raise AssertionError('Anonymous API allowed')
   except urllib.error.HTTPError as e:assert e.code==401
  for path in ['/api/bills-forms','/api/bills-forms/standard']:
   req=urllib.request.Request(base+path,data=b'{}',headers={'Content-Type':'application/json'})
   try:urllib.request.urlopen(req,timeout=10);raise AssertionError('Anonymous issuance allowed')
   except urllib.error.HTTPError as e:assert e.code==401
  for path in ['services-proposal','official-letter','internal-memo','quotation','daily-report','daily-budget','meeting-minutes','residential-lease','brokerage-contract','content-plan']:
   assert urllib.request.urlopen(base+'/bills-forms/'+path,timeout=10).status==200
 # No production fixtures or documents were issued by deployment checks.
 # Keep any documents issued by real users during release verification.
except Exception:
 for name in files:
  if name in existing:shutil.copy2(backup/'source'/name,live/name)
  elif (live/name).is_file():(live/name).unlink()
 restart(rollback)
 (backup/'rollback-receipt.json').write_text(json.dumps({'rolled_back':True,'migration_retained':applied}))
 raise RuntimeError('Release checks failed; previous source/image restored; private backup retained') from None
checkpoint={'image':built['image'],'image_id':built['image_id'],'previous_image':old['Image'],'migration_applied':True,'migration_sha':built['migration_sha'],'backup':str(backup),'google_preserved':True,'runtime_unchanged':True,'production_fixtures':False}
(backup/'checkpoint.json').write_text(json.dumps(checkpoint));(stage/'standard-deployment.json').write_text(json.dumps(checkpoint))
print('DEPLOYED: '+built['image']+' '+built['image_id'])
print('Private backup/current override: '+str(override))
print('New standard-forms migration applied; runtime unchanged; public pages and protected API checks passed')


