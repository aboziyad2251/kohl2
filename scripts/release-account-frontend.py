"""Preview or release only account pages; keep the canonical main image unchanged."""
import datetime, json, os, pathlib, subprocess, sys, urllib.request
os.umask(0o077)
runtime = {}
exec(compile(pathlib.Path('/home/debian/projects/release-broker-ui.py').read_text().split("if sys.argv[1]=='build':")[0], 'runtime', 'exec'), runtime)
api, inspect = runtime['api'], runtime['inspect']
stage = pathlib.Path('/home/debian/projects/kohl-account-frontend-20261109')
built = json.loads((stage / 'build.json').read_text())
def spawn(name, network):
    if subprocess.run(['docker', 'network', 'inspect', network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
        api('POST', '/networks/create', {'Name': network, 'Internal': True})
    obj = api('POST', '/containers/create?name=' + name, {
        'Image': built['image_id'],
        'Env': ['NODE_ENV=production', 'PORT=3000', 'HOSTNAME=0.0.0.0', 'GOOGLE_LOGIN_ENABLED=true', 'PASSWORD_RECOVERY_ENABLED=true'],
        'ExposedPorts': {'3000/tcp': {}},
        'HostConfig': {'NetworkMode': network, 'RestartPolicy': {'Name': 'unless-stopped' if name == 'kohl_account_frontend' else 'no'}},
        'NetworkingConfig': {'EndpointsConfig': {network: {'Aliases': [name]}}}})
    api('POST', '/containers/' + obj['Id'] + '/start')
    ip = inspect(name)['NetworkSettings']['Networks'][network]['IPAddress']
    runtime['ready']('http://' + ip + ':3000')
    return ip
if sys.argv[1] == 'preview':
    print('PREVIEW_IP=' + spawn('kohl_account_preview', 'kohl_broker_ui_review'))
elif sys.argv[1] == 'deploy':
    accepted = json.loads((stage / 'browser-acceptance.json').read_text())
    assert accepted['passed'] and accepted['image_id'] == built['image_id']
    assert inspect('kohl_crm_app')['Image'] == built['main_image']
    proxy = 'nginx_proxy_manager'; path = '/data/nginx/proxy_host/8.conf'
    old_config = subprocess.check_output(['docker', 'exec', proxy, 'cat', path]).decode()
    read = "const D=require('better-sqlite3'),d=new D('/data/database.sqlite',{readonly:true});console.log(JSON.stringify(d.prepare('select advanced_config from proxy_host where id=8').get()));d.close()"
    row = json.loads(subprocess.check_output(['docker', 'exec', '-w', '/app', proxy, 'node', '-e', read]))
    assert '__broker_ui' in row['advanced_config'] and '__account_ui' not in row['advanced_config']
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = pathlib.Path('/home/debian/backups') / ('kohl-account-' + stamp); backup.mkdir(mode=0o700)
    (backup / 'proxy-before.conf').write_text(old_config)
    (backup / 'proxy-row-before.json').write_text(json.dumps(row))
    spawn('kohl_account_frontend', 'kohl_external_portal')
    block = '\n  # Kohl isolated password recovery pages.\n'
    for route in ['/auth/forgot-password', '/auth/set-password', '/api/auth/providers']:
        block += '''  location = ROUTE {
    if ($http_rsc = "1") { return 409; }
    proxy_pass http://kohl_account_frontend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    add_header Cache-Control "no-store" always;
  }
'''.replace('ROUTE', route)
    block += '''  location ^~ /__account_ui/_next/static/ {
    proxy_pass http://kohl_account_frontend:3000/_next/static/;
    proxy_set_header Host $host;
  }
'''
    update = "const fs=require('fs'),D=require('better-sqlite3'),p=JSON.parse(fs.readFileSync(0,'utf8')),d=new D('/data/database.sqlite');d.prepare('update proxy_host set advanced_config=? where id=8').run(p.advanced);d.close();fs.writeFileSync('/data/nginx/proxy_host/8.conf',p.config)"
    def apply(advanced, config):
        subprocess.run(['docker', 'exec', '-i', '-w', '/app', proxy, 'node', '-e', update], input=json.dumps({'advanced': advanced, 'config': config}).encode(), check=True)
        subprocess.run(['docker', 'exec', proxy, 'nginx', '-t'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        subprocess.run(['docker', 'exec', proxy, 'nginx', '-s', 'reload'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        assert '  # Custom' in old_config
        apply(row['advanced_config'] + block, old_config.replace('  # Custom', block + '\n  # Custom', 1))
        base = 'https://app.kohlestate-ksa.online'
        import re, time
        time.sleep(2)
        for route in ['/auth/forgot-password', '/auth/set-password']:
            html = urllib.request.urlopen(base + route, timeout=20).read().decode()
            assets = re.findall(r'(?:src|href)="([^" ]*__account_ui/_next/static/[^" ]+)"', html)
            assert assets
            for asset in assets: assert urllib.request.urlopen(base + asset, timeout=20).status == 200
        assert json.load(urllib.request.urlopen(base + '/api/auth/providers')) == {'google': True, 'recovery': True}
        for route in ['/login', '/today', '/calendar', '/audit', '/activity', '/settings']:
            assert urllib.request.urlopen(base + route, timeout=20).status == 200
        assert '/__broker_ui/' in urllib.request.urlopen(base + '/portal').read().decode()
        assert inspect('kohl_crm_app')['Image'] == built['main_image']
    except Exception:
        apply(row['advanced_config'], old_config)
        raise
    receipt = {**built, 'main_preserved': True, 'backup': str(backup), 'recovery_enabled': True}
    (stage / 'deployment.json').write_text(json.dumps(receipt)); (backup / 'receipt.json').write_text(json.dumps(receipt))
    print('ACCOUNT_FRONTEND_DEPLOYED=' + built['image_id']); print('CHECKPOINT=' + str(backup))
else:
    raise ValueError('Use preview or deploy')
