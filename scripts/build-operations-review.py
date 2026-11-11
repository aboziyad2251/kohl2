"""Build-only candidate; optionally run isolated synthetic API acceptance. No cutover."""
import argparse
import json
from pathlib import Path
import subprocess
import sys

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--test',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parent.parent
def output(command):
    return subprocess.check_output(command,text=True).strip()
head=output(['git','-C',str(root),'rev-parse','HEAD'])
if output(['git','-C',str(root),'status','--porcelain']):
    raise SystemExit('STOP: source has local changes; inspect before build')
unexpected=[p for p in root.glob('.env*') if p.name not in ('.env.example','.env.local.example')]
if unexpected:
    raise SystemExit('STOP: environment files present; inspect before build')
app=json.loads(output(['docker','inspect','kohl_crm_app']))[0]
env=dict(x.split('=',1) for x in app['Config'].get('Env',[]) if '=' in x)
image='kohl-operations-review:'+head[:12]
command=['docker','build','-f','Dockerfile.next','-t',image]
for key in ('NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'):
    if not env.get(key):raise SystemExit('STOP: public build configuration missing')
    command+=['--build-arg',key+'='+env[key]]
subprocess.run(command+['.'],cwd=root,check=True)
image_id=output(['docker','image','inspect',image,'--format','{{.Id}}'])
print('BUILD OK: '+image_id,flush=True)
print('Source: '+head,flush=True)
if args.test:
    subprocess.run([sys.executable,'-B',str(root/'scripts/test-operations-services.py'),
                    '--application','--app-image',image_id],check=True)
print('No production deployment or migration performed.',flush=True)
