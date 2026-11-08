"""Preview/deploy only /portal with isolated assets; preserve the restored main app."""
import datetime,http.server,json,os,pathlib,subprocess,sys,urllib.request,urllib.error
os.umask(0o077)
runtime={}
exec(compile(pathlib.Path('/home/debian/projects/release-broker-ui.py').read_text().split("if sys.argv[1]=='build':")[0],'release-broker-ui.py','exec'),runtime)
api,inspect=runtime['api'],runtime['inspect']
stage=pathlib.Path('/home/debian/projects/kohl-broker-frontend-20261109')
built=json.loads((stage/'frontend-build.json').read_text())
def spawn(name,network):
 if subprocess.run(['docker','network','inspect',network],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:api('POST','/networks/create',{'Name':network,'Internal':True})
 config={'Image':built['image_id'],'Env':['NODE_ENV=production','PORT=3000','HOSTNAME=0.0.0.0','GOOGLE_LOGIN_ENABLED=true','PASSWORD_RECOVERY_ENABLED=false'],'ExposedPorts':{'3000/tcp':{}},'HostConfig':{'NetworkMode':network,'RestartPolicy':{'Name':'unless-stopped' if name=='kohl_broker_frontend' else 'no','MaximumRetryCount':0}},'NetworkingConfig':{'EndpointsConfig':{network:{'Aliases':[name]}}}}
 result=api('POST','/containers/create?name='+name,config);api('POST','/containers/'+result['Id']+'/start')
 obj=inspect(name);ip=obj['NetworkSettings']['Networks'][network]['IPAddress'];runtime['ready']('http://'+ip+':3000');return ip
class Preview(http.server.BaseHTTPRequestHandler):
 def do_GET(self):
  path=self.path
  if path.split('?')[0]=='/portal' and self.headers.get('RSC')=='1':self.send_response(409);self.end_headers();return
  upstream=self.server.broker if path.split('?')[0]=='/portal' or path.startswith('/__broker_ui/_next/static/') else self.server.main
  if path.startswith('/__broker_ui/'):path=path[len('/__broker_ui'):]
  request=urllib.request.Request(upstream+path,headers={k:v for k,v in self.headers.items() if k.lower() not in ['host','connection']})
  try:response=urllib.request.urlopen(request,timeout=20)
  except urllib.error.HTTPError as error:response=error
  body=response.read();self.send_response(response.status)
  for key,value in response.headers.items():
   if key.lower() not in ['transfer-encoding','connection','content-length']:self.send_header(key,value)
  self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def log_message(self,*args):pass
if sys.argv[1]=='preview':
 ip=spawn('kohl_broker_frontend_preview','kohl_broker_ui_review');print('Credential-free broker preview ready: '+ip)
elif sys.argv[1]=='serve':
 def address(name):return 'http://'+next(iter(inspect(name)['NetworkSettings']['Networks'].values()))['IPAddress']+':3000'
 server=http.server.ThreadingHTTPServer(('127.0.0.1',39182),Preview);server.main=address('kohl_nav_restore_preview');server.broker=address('kohl_broker_frontend_preview');print('Isolated combined preview ready',flush=True);server.serve_forever()
elif sys.argv[1]=='deploy':
 accepted=json.loads((stage/'browser-acceptance.json').read_text());assert accepted['passed'] and accepted['image_id']==built['image_id']
 assert inspect('kohl_crm_app')['Image']==built['main_image']
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');backup=pathlib.Path('/home/debian/backups')/('kohl-broker-frontend-'+stamp);backup.mkdir(mode=0o700)
 proxy='nginx_proxy_manager';config_path='/data/nginx/proxy_host/8.conf'
 old_config=subprocess.check_output(['docker','exec',proxy,'cat',config_path]).decode()
 read_row="const D=require('better-sqlite3');const d=new D('/data/database.sqlite',{readonly:true});console.log(JSON.stringify(d.prepare('select advanced_config from proxy_host where id=8').get()));d.close()"
 old_row=json.loads(subprocess.check_output(['docker','exec','-w','/app',proxy,'node','-e',read_row]));assert not old_row['advanced_config'],'Inspect existing advanced routing before combining'
 (backup/'proxy-before.conf').write_text(old_config);(backup/'proxy-row-before.json').write_text(json.dumps(old_row))
 network='kohl_external_portal';spawn('kohl_broker_frontend',network)
 api('POST','/networks/'+network+'/connect',{'Container':proxy,'EndpointConfig':{}})
 block='''
  # Kohl isolated external portal; main release and its assets remain unchanged.
  location = /portal {
    if ($http_rsc = "1") { return 409; }
    proxy_pass http://kohl_broker_frontend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    add_header Cache-Control "no-store" always;
  }
  location = /portal/ { return 308 /portal; }
  location ^~ /__broker_ui/_next/static/ {
    proxy_pass http://kohl_broker_frontend:3000/_next/static/;
    proxy_set_header Host $host;
  }
'''
 update="const fs=require('fs'),D=require('better-sqlite3'),p=JSON.parse(fs.readFileSync(0,'utf8'));const d=new D('/data/database.sqlite');d.prepare('update proxy_host set advanced_config=? where id=8').run(p.advanced);d.close();fs.writeFileSync('/data/nginx/proxy_host/8.conf',p.config)"
 def apply(advanced,config):
  subprocess.run(['docker','exec','-i','-w','/app',proxy,'node','-e',update],input=json.dumps({'advanced':advanced,'config':config}).encode(),check=True)
  subprocess.run(['docker','exec',proxy,'nginx','-t'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  subprocess.run(['docker','exec',proxy,'nginx','-s','reload'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 try:
  assert '  # Custom' in old_config
  apply(block,old_config.replace('  # Custom',block+'\n  # Custom',1))
  base='https://app.kohlestate-ksa.online'
  runtime['ready'](base)
  for path in ['/today','/calendar','/audit','/activity','/settings','/login']:assert urllib.request.urlopen(base+path,timeout=20).status==200
  portal=urllib.request.urlopen(base+'/portal',timeout=20).read().decode();assert '/__broker_ui/_next/static/' in portal
  import re
  assets=re.findall(r'(?:src|href)="([^" ]*__broker_ui/_next/static/[^" ]+)"',portal);assert assets
  for asset in assets:assert urllib.request.urlopen(base+asset,timeout=20).status==200
  runtime['checks'](base);assert inspect('kohl_crm_app')['Image']==built['main_image']
 except Exception:
  apply(old_row['advanced_config'],old_config);raise
 receipt={**built,'backup':str(backup),'main_preserved':True,'no_production_credentials_in_frontend':True,'no_database_auth_changes':True}
 (backup/'checkpoint.json').write_text(json.dumps(receipt));(stage/'deployment.json').write_text(json.dumps(receipt));print('BROKER FRONTEND DEPLOYED '+built['image_id']);print('Main grouped-navigation image preserved; rollback checkpoint '+str(backup))
else:raise ValueError('Use preview, serve or deploy')
