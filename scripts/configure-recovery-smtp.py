"""Apply privately supplied SMTP settings; preserve all other live Auth settings."""
import datetime, json, os, pathlib, re, shutil, smtplib, ssl, subprocess, time, urllib.request
os.umask(0o077)
private = pathlib.Path('/home/debian/.config/kohl-mail')
c = json.loads((private / 'smtp-settings.json').read_text(encoding='utf-8-sig'))
assert c['host'] == 'mail.kohlestate-ksa.online' and int(c['port']) == 587
def inspect():
    return json.loads(subprocess.check_output(['docker', 'inspect', 'supabase-auth']))[0]
def environment(obj):
    return dict(v.split('=', 1) for v in obj['Config']['Env'])
before = inspect(); old = environment(before)
cwd = pathlib.Path('/home/debian/supabase/docker')
def compose():
    return json.loads(subprocess.check_output(['docker', 'compose', 'config', '--format', 'json'], cwd=cwd, stderr=subprocess.DEVNULL))['services']['auth']['environment']
assert all(old.get(k) == str(v) for k, v in compose().items()), 'Resolve existing Auth configuration drift first'
with smtplib.SMTP(c['host'], int(c['port']), timeout=25) as smtp:
    smtp.ehlo(); smtp.starttls(context=ssl.create_default_context()); smtp.ehlo()
    smtp.login(c['username'], c['password'])
print('VPS_SMTP_AUTHENTICATED=True', flush=True)
updates = {'SMTP_HOST': c['host'], 'SMTP_PORT': str(c['port']), 'SMTP_USER': c['username'],
           'SMTP_PASS': c['password'], 'SMTP_ADMIN_EMAIL': c['sender_email'], 'SMTP_SENDER_NAME': c['sender_name']}
expected = {'GOTRUE_' + k: v for k, v in updates.items()}
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup = pathlib.Path('/home/debian/backups') / ('kohl-smtp-' + stamp)
backup.mkdir(mode=0o700)
envfile = cwd / '.env'
shutil.copy2(envfile, backup / 'env-before')
(backup / 'auth-container-before.json').write_text(json.dumps(before))
text = envfile.read_text()
for k, v in updates.items():
    assert '\n' not in v and '\r' not in v
    # Compose single-quoted dotenv values preserve dollar signs literally.
    line = k + "='" + v.replace('\\', '\\\\').replace("'", "\\'") + "'"
    pattern = r'(?m)^' + k + r'=.*$'
    assert len(re.findall(pattern, text)) == 1, 'Expected one existing SMTP key: ' + k
    text = re.sub(pattern, lambda _: line, text)
def restart():
    with (backup / 'recreate.log').open('ab') as log:
        subprocess.run(['docker', 'compose', 'up', '-d', '--no-deps', '--pull', 'never', 'auth'], cwd=cwd, stdout=log, stderr=log, check=True)
def healthy():
    obj = inspect()
    ip = obj['NetworkSettings']['Networks']['supabase_default']['IPAddress']
    for _ in range(40):
        try:
            if urllib.request.urlopen('http://' + ip + ':9999/health', timeout=2).status == 200:
                return obj
        except Exception:
            time.sleep(1)
    raise RuntimeError('Auth health check failed')
try:
    envfile.write_text(text)
    compiled = {k: str(v) for k, v in compose().items()}
    assert all(compiled.get(k) == v for k, v in expected.items()), 'SMTP value round-trip failed'
    assert all(old.get(k) == v for k, v in compiled.items() if k not in expected), 'Unexpected Auth change'
    restart(); after = healthy(); live = environment(after)
    assert after['Image'] == before['Image']
    assert all(live.get(k) == v for k, v in old.items() if k not in expected)
    assert all(live.get(k) == v for k, v in expected.items())
except Exception:
    shutil.copy2(backup / 'env-before', envfile); restart(); healthy()
    raise RuntimeError('SMTP update rolled back; inspect private checkpoint') from None
(backup / 'receipt.json').write_text(json.dumps({'smtp_configured': True, 'auth_image_preserved': True, 'other_settings_preserved': True}))
print('AUTH_SMTP_CONFIGURED=True')
print('CHECKPOINT=' + str(backup))
