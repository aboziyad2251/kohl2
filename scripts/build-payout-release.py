"""Build main/broker candidates from the reconciled, reviewed source archive."""
import hashlib,json,os,pathlib,shutil,subprocess,tarfile
os.umask(0o077)
stage=pathlib.Path('/home/debian/projects/kohl-payout-release-20261109')
assert not stage.exists(),'Inspect existing release stage first'
stage.mkdir(mode=0o700)
archive=pathlib.Path('/home/debian/projects/payout-source.tar')
source=stage/'source';source.mkdir()
with tarfile.open(archive) as tar:
 for member in tar.getmembers():
  assert (source/member.name).resolve().is_relative_to(source.resolve()) and (member.isfile() or member.isdir())
 tar.extractall(source)
assert not (source/'.env.local').exists() and not (source/'.portal-stage').exists()
old=json.loads(subprocess.check_output(['docker','inspect','kohl_crm_app']))[0]
assert old['Image']=='sha256:4128d746c87f15ff345a57de78be75b83c0551da0b368f202250484eb8c874d3'
env=dict(v.split('=',1) for v in old['Config']['Env'])
receipt={'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'previous_main':old['Image']}
for kind in ['main','broker']:
 folder=source
 if kind=='broker':
  folder=stage/'broker';shutil.copytree(source,folder)
  shutil.copyfile(folder/'components/auth/ExternalPortalShell.tsx',folder/'components/auth/AppShell.tsx')
  config=folder/'next.config.mjs';s=config.read_text();assert "output: 'standalone'," in s and 'assetPrefix' not in s
  config.write_text(s.replace("output: 'standalone',","output: 'standalone',\n  assetPrefix: '/__broker_ui',"))
 tag='kohl-payout-'+kind+':20261109'
 with (stage/(kind+'-build.log')).open('wb') as log:
  result=subprocess.run(['docker','build','-f','Dockerfile.next','-t',tag,'--build-arg','NEXT_PUBLIC_SUPABASE_URL='+env['NEXT_PUBLIC_SUPABASE_URL'],'--build-arg','NEXT_PUBLIC_SUPABASE_ANON_KEY='+env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],'.'],cwd=folder,stdout=log,stderr=subprocess.STDOUT)
 assert result.returncode==0,'Inspect private '+kind+' build log'
 image=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]
 receipt[kind]={'tag':tag,'image_id':image['Id']}
 print(kind.upper()+'_IMAGE_BUILT='+image['Id'],flush=True)
(stage/'build.json').write_text(json.dumps(receipt))
