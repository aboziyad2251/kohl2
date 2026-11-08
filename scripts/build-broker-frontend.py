"""Build a credential-free external portal; leave the restored main image intact."""
import hashlib,json,os,pathlib,shutil,subprocess
os.umask(0o077)
base=pathlib.Path('/home/debian/projects/kohl-broker-ui-release-20261108r2')
stage=pathlib.Path('/home/debian/projects/kohl-broker-frontend-20261109')
assert not stage.exists(),'Inspect existing stage before reuse'
old=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
assert old['Image']=='sha256:4128d746c87f15ff345a57de78be75b83c0551da0b368f202250484eb8c874d3'
shutil.copytree(base,stage,ignore=shutil.ignore_patterns('.next*','node_modules','.env*','*.log','*.json.receipt'))
shell=pathlib.Path(__file__).with_name('ExternalPortalShell.tsx').read_bytes()
(stage/'components/auth/AppShell.tsx').write_bytes(shell)
config=stage/'next.config.mjs';text=config.read_text();assert "output: 'standalone'," in text
config.write_text(text.replace("output: 'standalone',","output: 'standalone',\n  assetPrefix: '/__broker_ui',"))
env=dict(value.split('=',1) for value in old['Config']['Env']);image='kohl-broker-frontend:20261109'
with (stage/'frontend-build.log').open('wb') as log:
 result=subprocess.run(['docker','build','-f','Dockerfile.next','-t',image,'--build-arg','NEXT_PUBLIC_SUPABASE_URL='+env['NEXT_PUBLIC_SUPABASE_URL'],'--build-arg','NEXT_PUBLIC_SUPABASE_ANON_KEY='+env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],'.'],cwd=stage,stdout=log,stderr=subprocess.STDOUT)
assert result.returncode==0,'Build failed; inspect private frontend-build.log'
built=json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]
(stage/'frontend-build.json').write_text(json.dumps({'image':image,'image_id':built['Id'],'main_image':old['Image'],'asset_prefix':'/__broker_ui','shell_sha':hashlib.sha256(shell).hexdigest()}))
print('Isolated broker frontend built: '+built['Id'])
