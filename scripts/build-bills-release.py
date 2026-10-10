import json, os, pathlib, subprocess, hashlib
os.umask(0o077)
stage=pathlib.Path('/home/debian/projects/kohl-bills-release-20261010')
live=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
e=dict(x.split('=',1) for x in live['Config']['Env'])
files=json.loads((stage/'bills-source-files.json').read_text())
previous={f:hashlib.sha256((pathlib.Path('/home/debian/projects/kohl-crm-app')/f).read_bytes()).hexdigest() if (pathlib.Path('/home/debian/projects/kohl-crm-app')/f).exists() else None for f in files}
image='kohl-bills:20261010'
with (stage/'bills-build.log').open('wb') as log:
 r=subprocess.run(['docker','build','-f','Dockerfile.next','-t',image,'--build-arg','NEXT_PUBLIC_SUPABASE_URL='+e['NEXT_PUBLIC_SUPABASE_URL'],'--build-arg','NEXT_PUBLIC_SUPABASE_ANON_KEY='+e['NEXT_PUBLIC_SUPABASE_ANON_KEY'],'.'],cwd=stage,stdout=log,stderr=subprocess.STDOUT)
assert r.returncode==0,'Build failed; private bills-build.log contains diagnostics'
built=json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]
(stage/'bills-build.json').write_text(json.dumps({'image':image,'image_id':built['Id'],'previous_image':live['Image'],'source_before':previous,'migration_sha':hashlib.sha256((stage/'supabase/migrations/20261009225626_bills_forms.sql').read_bytes()).hexdigest()}))
print('Bills production image built: '+built['Id'])
