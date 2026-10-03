"""VPS operator: approved password release, preserve configuration and rollback image.

No database migration, account provisioning or signing-key rotation.
"""
import datetime, json, os, pathlib, shutil, subprocess, time, urllib.request
os.umask(0o077)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup=pathlib.Path('/home/debian/backups')/('kohl-passwords-'+stamp)
backup.mkdir(mode=0o700)
live=pathlib.Path('/home/debian/projects/kohl-crm-app')
stage=pathlib.Path('/home/debian/projects/kohl-password-release')
auth=pathlib.Path('/home/debian/supabase/docker')
def run(command,cwd=None):
    result=subprocess.run(command,cwd=cwd,capture_output=True)
    with (backup/'operations.log').open('ab') as log: log.write(result.stdout+result.stderr)
    if result.returncode: raise RuntimeError('Operation failed; inspect private operations.log')
    return result.stdout
old=json.loads(run(['docker','inspect','kohl_crm_app']))[0]
assert old['Config']['Image']=='kohl-phase-a:verified-20261003', 'Unexpected live image; inspect first'
run(['docker','image','inspect','kohl-passwords:20261004'])
shutil.copy2(auth/'.env',backup/'supabase.env.before')
shutil.copy2(live/'.env',backup/'app.env.before')
files=['app/api/access/users/route.ts','app/users-access/page.tsx','lib/portal/validation.ts']
for file in files:
    saved=backup/'source'/file; saved.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(live/file,saved)
override=backup/'app-image-override.json'
override.write_text(json.dumps({'services':{'kohl_crm_app':{'image':'kohl-passwords:20261004'}}}))
rollback=backup/'rollback-image.json'
rollback.write_text(json.dumps({'services':{'kohl_crm_app':{'image':old['Image']}}}))
settings=(auth/'.env').read_text().splitlines()
assert 'DISABLE_SIGNUP=true' in settings and 'ENABLE_EMAIL_SIGNUP=false' in settings
# This enables the email/password provider; GOTRUE_DISABLE_SIGNUP remains true.
(auth/'.env').write_text('\n'.join('ENABLE_EMAIL_SIGNUP=true' if line=='ENABLE_EMAIL_SIGNUP=false' else line for line in settings)+'\n')
run(['docker','compose','up','-d','--no-deps','auth'],auth)
runtime=json.loads(run(['docker','inspect','supabase-auth']))[0]
flags=dict(x.split('=',1) for x in runtime['Config']['Env'] if '=' in x)
assert flags['GOTRUE_DISABLE_SIGNUP']=='true' and flags['GOTRUE_EXTERNAL_EMAIL_ENABLED']=='true'
compose=['docker','compose','--env-file','.env','-f','docker-compose.next.yml','-f',str(override)]
try:
    run(compose+['up','-d','--no-build','--no-deps','kohl_crm_app'],live)
    ready=False
    for _ in range(30):
        try:
            ready=urllib.request.urlopen('http://127.0.0.1:3020/login',timeout=2).status==200
            if ready: break
        except Exception: pass
        time.sleep(1)
    assert ready, 'Release failed startup'
except Exception:
    run(['docker','compose','--env-file','.env','-f','docker-compose.next.yml','-f',str(rollback),'up','-d','--no-build','--no-deps','kohl_crm_app'],live)
    raise
for file in files: shutil.copy2(stage/file,live/file)
(backup/'checkpoint.json').write_text(json.dumps({'image':'kohl-passwords:20261004','previous_image':old['Image'],'public_signup_disabled':True,'password_provider_enabled':True}))
print('Password release running; email/password provider enabled; public signup disabled')
print('Private backup and image override: '+str(backup))
