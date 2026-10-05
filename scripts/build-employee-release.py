"""Stage build only: use the current public build key without logging credentials."""
import json, os, pathlib, subprocess
os.umask(0o077)
stage=pathlib.Path('/home/debian/projects/kohl-employee-release')
live=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
assert live['Config']['Image']=='kohl-passwords:20261004'
env=dict(x.split('=',1) for x in live['Config']['Env'] if '=' in x)
command=['docker','build','-f','Dockerfile.next','-t','kohl-employees:20261004',
    '--build-arg','NEXT_PUBLIC_SUPABASE_URL='+env['NEXT_PUBLIC_SUPABASE_URL'],
    '--build-arg','NEXT_PUBLIC_SUPABASE_ANON_KEY='+env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],'.']
with (stage/'employee-build.log').open('wb') as log:
    result=subprocess.run(command,cwd=stage,stdout=log,stderr=subprocess.STDOUT)
assert result.returncode==0, 'Build failed; inspect private staging build log'
print('Employee release production build passed')
