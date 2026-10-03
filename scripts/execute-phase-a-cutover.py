"""Reviewed VPS cutover. Explicit --confirm required. Failures retain maintenance.

Uses the already tested image and pending coordinated keys. Never hard-resets Git,
rebuilds during downtime, prints secrets, or restores insecure anonymous policies.
"""
import argparse,base64,hashlib,hmac,json,os,pathlib,shutil,subprocess,time,urllib.request

p=argparse.ArgumentParser();p.add_argument('--confirm',action='store_true');args=p.parse_args()
if not args.confirm:raise SystemExit('Explicit --confirm required')
os.umask(0o077)
folder=pathlib.Path('/home/debian/backups/kohl-cutover-20261003T144142Z')
pending=pathlib.Path('/home/debian/backups/kohl-phase-a-20261003T074600Z')
base=pathlib.Path('/home/debian/supabase/docker')
live=pathlib.Path('/home/debian/projects/kohl-crm-app')
stage=pathlib.Path('/home/debian/projects/kohl-phase-a-release')
image='sha256:192b426366f0582420f1f625dad3753bd880117be87b92f33a6a6d806ff7cbe3'
tag='kohl-phase-a:verified-20261003'
log=(folder/'cutover.log').open('ab',buffering=0)
def run(cmd,**kwargs):
    result=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kwargs)
    log.write(result.stdout+result.stderr)
    if result.returncode:raise RuntimeError('Operation failed; see private cutover.log')
    return result.stdout
def step(name):
    (folder/'cutover-status.txt').write_text(name+'\n');print(name,flush=True)
def env(path):return dict(line.split('=',1) for line in path.read_text().splitlines() if '=' in line and not line.startswith('#'))
def sql(query,db='postgres'):
    return run(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1','-At'],input=query.encode())
def compose(*options):return run(['docker','compose',*options],cwd=base)
def maintenance():
    exists=subprocess.run(['docker','inspect','kohl_cutover_maintenance'],capture_output=True).returncode==0
    if not exists:
        run(['docker','run','-d','--name','kohl_cutover_maintenance','--restart','unless-stopped','-p','127.0.0.1:3020:3000',image,'node','-e',"require('http').createServer((q,r)=>{r.writeHead(503,{'Content-Type':'text/html; charset=utf-8','Retry-After':'120'});r.end('<html lang=ar dir=rtl><meta charset=utf-8><title>Kohl — maintenance</title><h1>جارٍ تحديث النظام</h1><p>نحفظ بياناتكم ونجهز تسجيل الدخول الآمن. يرجى العودة بعد قليل.</p></html>')}).listen(3000,'0.0.0.0')"])

assert not (folder/'cutover-started').exists(),'Cutover already started; inspect state before resuming'
assert json.loads((folder/'checkpoint.json').read_text())['restore_verified']
assert not run(['git','status','--porcelain'],cwd=live).strip(),'Preserve live checkout edits first'
old=env(base/'.env');new=env(pending/'supabase.env.pending');app=env(pending/'app.env.pending')
assert new['JWT_SECRET']!=old['JWT_SECRET'] and len(new['JWT_SECRET'])>=32
for field,role in [('ANON_KEY','anon'),('SERVICE_ROLE_KEY','service_role')]:
    body,sig=new[field].rsplit('.',1)
    expected=base64.urlsafe_b64encode(hmac.new(new['JWT_SECRET'].encode(),body.encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
    assert hmac.compare_digest(sig,expected)
    assert json.loads(base64.urlsafe_b64decode(body.split('.')[1]+'==='))['role']==role
assert app['NEXT_PUBLIC_SUPABASE_ANON_KEY']==new['ANON_KEY'] and app['SUPABASE_SERVICE_ROLE_KEY']==new['SERVICE_ROLE_KEY']
assert new['DISABLE_SIGNUP']=='true' and new['ENABLE_PHONE_SIGNUP']=='false'
assert sql("select count(*) from auth.users;").strip()==b'0','Unexpected production users'
run(['docker','image','inspect',image])
run(['docker','tag',image,tag])
run(['git','fetch','origin','codex/phase-a-production-cutover'],cwd=live)
run(['git','merge','--ff-only','1883b16'],cwd=live)
override=folder/'app-image-override.json';override.write_text(json.dumps({'services':{'kohl_crm_app':{'image':tag}}}))
app_command=['docker','compose','--env-file','.env','-f','docker-compose.next.yml','-f',str(override)]

(folder/'cutover-started').touch()
try:
    step('Entering maintenance and freezing legacy API writes')
    run(['docker','stop','kohl_crm_app']);run(['docker','rename','kohl_crm_app','kohl_crm_app_pre_phase_a'])
    maintenance();compose('stop','api-gw')
    step('Refreshing private backup at the write freeze')
    with (folder/'postgres-at-freeze.dump').open('wb') as out:
        result=subprocess.run(['docker','exec','supabase-db','pg_dump','-U','supabase_admin','-d','postgres','-Fc'],stdout=out,stderr=subprocess.PIPE)
        if result.returncode:raise RuntimeError('Final backup failed')
    final_db='kohl_cutover_final_restore_20261003'
    run(['docker','exec','supabase-db','createdb','-U','supabase_admin','-T','template0',final_db])
    with (folder/'postgres-at-freeze.dump').open('rb') as source:
        run(['docker','exec','-i','supabase-db','pg_restore','-U','supabase_admin','-d',final_db,'--exit-on-error'],stdin=source)
    run(['tar','-czf',str(folder/'legacy-site-at-freeze.tar.gz'),'-C','/home/debian/projects/my-new-site','html'])
    shutil.copy2(base/'.env',folder/'supabase.env.before')
    step('Applying the tested schema and role policies')
    migrations=[]
    for name in ['20261003143845_erp_live_compatibility.sql','20261003000256_external_portals_phase_a.sql']:
        text=(stage/'supabase/migrations'/name).read_text()
        # Both reviewed files have top-level transaction wrappers.
        lines=text.splitlines();lines=[line for line in lines if line.strip().lower() not in ('begin;','commit;')]
        migrations.append('\n'.join(lines))
    sql('begin;\n'+'\n'.join(migrations)+'\ncommit;')
    run(['python3',str(stage/'scripts/import-browser-business.py'),str(folder/'browser-backup.json'),'--database','postgres','--apply'])
    step('Rotating the signing keys across Supabase and clients')
    shutil.copyfile(pending/'supabase.env.pending',base/'.env');(base/'.env').chmod(0o600)
    shutil.copyfile(pending/'app.env.pending',live/'.env');(live/'.env').chmod(0o600)
    sql("alter database postgres set app.settings.jwt_secret = '"+new['JWT_SECRET'].replace("'","''")+"';")
    static=pathlib.Path('/home/debian/projects/my-new-site/html')
    for rel in ['js/supabase-service.js','html_website/js/supabase-service.js']:
        path=static/rel;path.write_text(path.read_text().replace(old['ANON_KEY'],new['ANON_KEY']))
    # Preserve the legacy source and browser storage; send its users to real Auth.
    (static/'nginx.conf').write_text('server { listen 80; server_name localhost; location / { return 302 https://app.kohlestate-ksa.online/login; } }\n')
    run(['docker','exec','new_site_web','nginx','-t']);run(['docker','exec','new_site_web','nginx','-s','reload'])
    compose('up','-d','--wait','--wait-timeout','150')
    step('Starting the verified release image')
    run(['docker','rm','-f','kohl_cutover_maintenance'])
    run([*app_command,'up','-d','--no-build'],cwd=live)
    for attempt in range(40):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3020/login',timeout=3) as response:
                if response.status==200:break
        except OSError:time.sleep(1)
    else:raise RuntimeError('Application failed readiness check')
    step('Provisioning and verifying the approved executives')
    result=run(['python3',str(stage/'scripts/bootstrap-cutover-executives.py'),'--users','/home/debian/.config/kohl/executive-accounts.json','--env',str(live/'.env'),'--database','postgres','--gateway','https://kohl.kohlestate-ksa.online','--app','https://app.kohlestate-ksa.online','--provision'])
    print(result.decode(),flush=True)
    step('Cutover complete; live executive login checks passed')
except Exception:
    subprocess.run(['docker','stop','kohl_crm_app'],capture_output=True)
    maintenance()
    step('Cutover requires recovery; application kept in maintenance')
    raise
