"""Deploy a verified image; preserve deployed source and runtime secrets. No SQL."""
import datetime, json, os, pathlib, shutil, subprocess, time, urllib.request, urllib.error
os.umask(0o077)
stage = pathlib.Path('/home/debian/projects/kohl-attention-release')
live = pathlib.Path('/home/debian/projects/kohl-crm-app')
accepted = json.loads((stage / 'attention-acceptance.json').read_text())
built = json.loads((stage / 'attention-build.json').read_text())
assert accepted['passed'] and accepted['image_id'] == built['image_id']
old = json.loads(subprocess.check_output(['docker', 'inspect', 'kohl_crm_app']))[0]
assert old['Image'] == built['previous_image'], 'Production image changed since staging'
backup = pathlib.Path('/home/debian/backups') / ('kohl-attention-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700)
shutil.copy2(live / '.env', backup / 'app.env.before')
files = json.loads((stage / 'attention-source-files.json').read_text())
assert all(not pathlib.PurePosixPath(f).is_absolute() and '..' not in pathlib.PurePosixPath(f).parts and f not in ['.env', 'AGENTS.md'] for f in files)
existing = []
for name in files:
    source = live / name
    if source.exists():
        existing.append(name)
        saved = backup / 'source' / name
        saved.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, saved)
override = backup / 'app-image-override.json'
rollback = backup / 'rollback-image.json'
override.write_text(json.dumps({'services': {'kohl_crm_app': {'image': built['image_id']}}}))
rollback.write_text(json.dumps({'services': {'kohl_crm_app': {'image': old['Image']}}}))
def run(config):
    command = ['docker', 'compose', '--env-file', '.env', '-f', 'docker-compose.next.yml', '-f', str(config), 'up', '-d', '--no-build', '--no-deps', 'kohl_crm_app']
    result = subprocess.run(command, cwd=live, capture_output=True)
    with (backup / 'operations.log').open('ab') as log: log.write(result.stdout + result.stderr)
    assert result.returncode == 0, 'Restart failed; inspect private operations.log'
try:
    for name in files:
        (live / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(stage / name, live / name)
    run(override)
    for _ in range(40):
        try:
            if urllib.request.urlopen('http://127.0.0.1:3020/login', timeout=3).status == 200: break
        except Exception: pass
        time.sleep(1)
    else: raise AssertionError('New app did not start')
    current = json.loads(subprocess.check_output(['docker', 'inspect', 'kohl_crm_app']))[0]
    assert current['Image'] == built['image_id']
    before = dict(x.split('=', 1) for x in old['Config']['Env'])
    after = dict(x.split('=', 1) for x in current['Config']['Env'])
    for key in set(before) | set(after):
        if key != 'PASSWORD_RECOVERY_ENABLED': assert before.get(key) == after.get(key), 'Unexpected runtime configuration change'
    assert after.get('PASSWORD_RECOVERY_ENABLED', 'false') == 'false', 'SMTP is not configured'
    providers = json.load(urllib.request.urlopen('https://app.kohlestate-ksa.online/api/auth/providers'))
    assert providers['google'] is True and providers['recovery'] is False
    assert urllib.request.urlopen('https://app.kohlestate-ksa.online/auth/forgot-password').status == 200
    for route in ['/api/portal/attention', '/api/access/users', '/api/portal/dashboard']:
        try: urllib.request.urlopen('https://app.kohlestate-ksa.online' + route); raise AssertionError('Anonymous API access allowed')
        except urllib.error.HTTPError as e: assert e.code == 401
except Exception:
    for name in existing: shutil.copy2(backup / 'source' / name, live / name)
    # New source files are harmless under the previous immutable image; retain them for recovery.
    run(rollback)
    raise RuntimeError('Release checks failed; previous source and image restored') from None
(backup / 'checkpoint.json').write_text(json.dumps({'image': built['image'], 'image_id': built['image_id'], 'previous_image': old['Image'], 'google_enabled': True, 'email_recovery_enabled': False, 'migration_applied': False}))
print('Action-center release deployed; Google preserved; recovery gated; protected APIs deny anonymous access')
print('Current backup and image override: ' + str(override))
