"""Build the action-center release with the deployed public Supabase configuration."""
import json, os, pathlib, subprocess
os.umask(0o077)
stage = pathlib.Path('/home/debian/projects/kohl-attention-release')
live = json.loads(subprocess.check_output(['docker', 'inspect', 'kohl_crm_app']))[0]
env = dict(x.split('=', 1) for x in live['Config']['Env'])
image = 'kohl-attention:20261008'
command = ['docker', 'build', '-f', 'Dockerfile.next', '-t', image,
           '--build-arg', 'NEXT_PUBLIC_SUPABASE_URL=' + env['NEXT_PUBLIC_SUPABASE_URL'],
           '--build-arg', 'NEXT_PUBLIC_SUPABASE_ANON_KEY=' + env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], '.']
with (stage / 'attention-build.log').open('wb') as log:
    result = subprocess.run(command, cwd=stage, stdout=log, stderr=subprocess.STDOUT)
assert result.returncode == 0, 'Build failed; inspect the private staging log'
built = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image]))[0]
(stage / 'attention-build.json').write_text(json.dumps({'image': image, 'image_id': built['Id'], 'previous_image': live['Image']}))
print('Action-center production image built: ' + built['Id'])
