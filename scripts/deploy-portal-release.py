"""Deploy the accepted portal image without resetting Git or changing Auth keys."""
import datetime, json, os, pathlib, shutil, subprocess, time, urllib.request, urllib.error
os.umask(0o077)
stage=pathlib.Path('/home/debian/projects/kohl-portals-release')
live=pathlib.Path('/home/debian/projects/kohl-crm-app')
image='kohl-portals:20261005'
accepted=json.loads((stage/'portal-acceptance.json').read_text())
assert accepted['passed'] and accepted['image']==image
old=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
assert old['Config']['Image']=='kohl-employees:20261004'
built=json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]
assert built['Id']==accepted['image_id']
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup=pathlib.Path('/home/debian/backups')/('kohl-portals-'+stamp)
backup.mkdir(mode=0o700)
def run(command,input=None,cwd=None):
 result=subprocess.run(command,input=input,cwd=cwd,capture_output=True)
 with (backup/'operations.log').open('ab') as log: log.write(result.stdout+result.stderr)
 if result.returncode: raise RuntimeError('Operation failed; inspect private operations.log')
 return result.stdout
def sql(query,db='postgres'):
 return run(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin','-d',db,'-At','-v','ON_ERROR_STOP=1'],input=query.encode()).decode().strip()
assert sql("select to_regprocedure('public.portal_workflow(uuid,text,jsonb)') is null")=='t', 'Portal migration already exists; inspect live state'
assert sql("select position('employee_id' in pg_get_functiondef('public.portal_admin(uuid,text,jsonb,uuid)'::regprocedure))>0")=='t'
shutil.copy2(live/'.env',backup/'app.env.before')
shutil.copy2(live/'docker-compose.next.yml',backup/'docker-compose.next.yml')
dump=run(['docker','exec','supabase-db','pg_dump','-U','supabase_admin','-d','postgres','-Fc'])
(backup/'postgres.dump').write_bytes(dump)
# Prove that the full database backup restores before any live schema mutation.
restore_db='kohl_portal_restore_'+stamp.lower()
assert restore_db.startswith('kohl_portal_restore_') and restore_db!='postgres'
sql('create database '+restore_db+' template template0')
try:
 run(['docker','exec','-i','supabase-db','pg_restore','-U','supabase_admin','--no-owner','--no-privileges','--exit-on-error','-d',restore_db],input=dump)
 assert sql("select count(*)>0 from portal_private.accounts",restore_db)=='t'
finally:
 sql('drop database '+restore_db+' with (force)')
files=json.loads((stage/'portal-source-files.json').read_text())
assert all(not pathlib.PurePosixPath(f).is_absolute() and '..' not in pathlib.PurePosixPath(f).parts and f!='.env' for f in files)
for file in files:
 if (live/file).exists():
  saved=backup/'source'/file; saved.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(live/file,saved)
override=backup/'app-image-override.json'
override.write_text(json.dumps({'services':{'kohl_crm_app':{'image':image}}}))
rollback=backup/'rollback-image.json'
rollback.write_text(json.dumps({'services':{'kohl_crm_app':{'image':old['Image']}}}))
def compose(config):
 return ['docker','compose','--env-file','.env','-f','docker-compose.next.yml','-f',str(config),'up','-d','--no-build','--no-deps','kohl_crm_app']
try:
 sql((stage/'supabase/migrations/20261005161549_role_portal_workflows.sql').read_text())
 run(compose(override),cwd=live)
 for _ in range(40):
  try:
   if urllib.request.urlopen('http://127.0.0.1:3020/login',timeout=2).status==200: break
  except Exception: pass
  time.sleep(1)
 else: raise AssertionError('Portal app did not start')
 current=json.loads(run(['docker','inspect','kohl_crm_app']))[0]
 assert current['Image']==accepted['image_id']
 before=dict(x.split('=',1) for x in old['Config']['Env'] if '=' in x)
 after=dict(x.split('=',1) for x in current['Config']['Env'] if '=' in x)
 for key in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SERVER_URL','GOOGLE_LOGIN_ENABLED']:
  assert before.get(key)==after.get(key), 'Runtime configuration changed'
 for path in ['/api/portal/dashboard','/api/access/users']:
  try: urllib.request.urlopen('http://127.0.0.1:3020'+path,timeout=10); raise AssertionError('Unauthenticated access allowed')
  except urllib.error.HTTPError as e: assert e.code==401
 assert sql("select count(*)=2 from portal_private.accounts where role in ('ADMIN','CEO') and is_active")=='t'
 assert sql("select bool_and(public.portal_workflow(user_id,'DASHBOARD','{}'::jsonb) is not null) from portal_private.accounts where role in ('ADMIN','CEO') and is_active")=='t'
except Exception:
 # Additive schema remains compatible with the employee image; never restore
 # a database over live writes as an automatic rollback.
 run(compose(rollback),cwd=live)
 raise
for file in files:
 (live/file).parent.mkdir(parents=True,exist_ok=True); shutil.copy2(stage/file,live/file)
(backup/'checkpoint.json').write_text(json.dumps({'image':image,'image_id':accepted['image_id'],'previous_image':old['Image'],'full_backup_restore_verified':True,'keys_unchanged':True,'real_test_accounts_created':False}))
print('Portal release deployed; full backup restore verified and Auth keys preserved')
print('Image ID: '+accepted['image_id'])
print('Private backup and current image override: '+str(backup))
