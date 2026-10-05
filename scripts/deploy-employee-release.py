"""Deploy the accepted employee feature, retaining current Auth settings and keys.

Only the administrative function changes in PostgreSQL. No real accounts are
created/reset, and no production credentials are printed or committed.
"""
import datetime, json, os, pathlib, shutil, subprocess, time, urllib.request
os.umask(0o077)
stage=pathlib.Path('/home/debian/projects/kohl-employee-release')
live=pathlib.Path('/home/debian/projects/kohl-crm-app')
image='kohl-employees:20261004'
accepted=json.loads((stage/'employee-acceptance.json').read_text())
assert accepted['passed'] and accepted['image']==image and set(accepted['creators'])=={'ADMIN','CEO'}
old=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
assert old['Config']['Image']=='kohl-passwords:20261004'
subprocess.run(['docker','image','inspect',image],check=True,stdout=subprocess.DEVNULL)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup=pathlib.Path('/home/debian/backups')/('kohl-employees-'+stamp)
backup.mkdir(mode=0o700)

def run(command,cwd=None,input=None):
    result=subprocess.run(command,cwd=cwd,input=input,capture_output=True)
    with (backup/'operations.log').open('ab') as log: log.write(result.stdout+result.stderr)
    if result.returncode: raise RuntimeError('Operation failed; inspect private operations.log')
    return result.stdout

def sql(query):
    return run(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=query.encode()).decode().strip()

# Guard against replacing a different live function. Only its body is compared,
# because pg_get_functiondef formats the header differently from source files.
original=sql("select pg_get_functiondef('public.portal_admin(uuid,text,jsonb,uuid)'::regprocedure)")
source=(stage/'supabase/migrations/20261003000256_external_portals_phase_a.sql').read_text()
expected=source.split('create function public.portal_admin(',1)[1].split('as $$',1)[1].split('end $$;',1)[0]+'end '
actual=original.split('AS $function$',1)[1].split('$function$',1)[0]
assert ''.join(expected.split())==''.join(actual.split()), 'Live function changed; inspect before deploying'
(backup/'portal-admin-before.sql').write_text(original+';\n')
shutil.copy2(live/'.env',backup/'app.env.before')
shutil.copy2(live/'docker-compose.next.yml',backup/'docker-compose.next.yml')
dump=run(['docker','exec','supabase-db','pg_dump','-U','supabase_admin','-d','postgres','-Fc'])
(backup/'postgres.dump').write_bytes(dump)
run(['docker','exec','-i','supabase-db','pg_restore','--list'],input=dump)
files=['app/users-access/page.tsx','lib/portal/types.ts','lib/portal/validation.ts',
    'supabase/migrations/20261004131256_employee_login_accounts.sql']
for file in files:
    if (live/file).exists():
        saved=backup/'source'/file; saved.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(live/file,saved)
override=backup/'app-image-override.json'
override.write_text(json.dumps({'services':{'kohl_crm_app':{'image':image}}}))
rollback=backup/'rollback-image.json'
rollback.write_text(json.dumps({'services':{'kohl_crm_app':{'image':old['Image']}}}))
compose=['docker','compose','--env-file','.env','-f','docker-compose.next.yml','-f',str(override)]
migration=(stage/files[-1]).read_text()
try:
    sql('begin;\n'+migration+'\ncommit;')
    run(compose+['up','-d','--no-build','--no-deps','kohl_crm_app'],live)
    for _ in range(30):
        try:
            if urllib.request.urlopen('http://127.0.0.1:3020/login',timeout=2).status==200: break
        except Exception: pass
        time.sleep(1)
    else: raise AssertionError('Release did not start')
    current=json.loads(run(['docker','inspect','kohl_crm_app']))[0]
    before=dict(x.split('=',1) for x in old['Config']['Env'] if '=' in x)
    after=dict(x.split('=',1) for x in current['Config']['Env'] if '=' in x)
    for key in ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SERVER_URL','GOOGLE_LOGIN_ENABLED']:
        assert before.get(key)==after.get(key), 'Runtime configuration changed unexpectedly'
except Exception:
    run(['docker','compose','--env-file','.env','-f','docker-compose.next.yml','-f',str(rollback),'up','-d','--no-build','--no-deps','kohl_crm_app'],live)
    sql('begin;\n'+original+';\ncommit;')
    raise
for file in files:
    (live/file).parent.mkdir(parents=True,exist_ok=True); shutil.copy2(stage/file,live/file)
(backup/'checkpoint.json').write_text(json.dumps({'image':image,'previous_image':old['Image'],'database_function_updated':True,'real_accounts_created':False,'keys_unchanged':True}))
print('Employee release deployed; passwords, Auth settings and signing keys preserved')
print('Private backup and current image override: '+str(backup))
