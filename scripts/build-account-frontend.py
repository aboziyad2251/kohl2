"""Build isolated account pages without replacing the preserved main application."""
import json, os, pathlib, shutil, subprocess
os.umask(0o077)
root = pathlib.Path('/home/debian/projects')
stage = root / 'kohl-account-frontend-20261109'
inputs = root / 'kohl-account-input-20261109'
assert not stage.exists(), 'Inspect existing account stage before reuse'
old = json.loads(subprocess.check_output(['docker', 'inspect', 'kohl_crm_app']))[0]
assert old['Image'] == 'sha256:4128d746c87f15ff345a57de78be75b83c0551da0b368f202250484eb8c874d3'
shutil.copytree(root / 'kohl-broker-ui-release-20261108r2', stage,
                ignore=shutil.ignore_patterns('.next*', 'node_modules', '.env*', '*.log', '*.json.receipt'))
for source, target in [('forgot-password.tsx', 'app/auth/forgot-password/page.tsx'),
                       ('set-password.tsx', 'app/auth/set-password/page.tsx'),
                       ('AccountShell.tsx', 'components/auth/AppShell.tsx'),
                       ('providers.ts', 'app/api/auth/providers/route.ts')]:
    shutil.copyfile(inputs / source, stage / target)
config = stage / 'next.config.mjs'
text = config.read_text()
assert "output: 'standalone'," in text and 'assetPrefix' not in text
config.write_text(text.replace("output: 'standalone',", "output: 'standalone',\n  assetPrefix: '/__account_ui',"))
env = dict(value.split('=', 1) for value in old['Config']['Env'])
image = 'kohl-account-frontend:20261109'
with (stage / 'build.log').open('wb') as log:
    result = subprocess.run(['docker', 'build', '-f', 'Dockerfile.next', '-t', image,
        '--build-arg', 'NEXT_PUBLIC_SUPABASE_URL=' + env['NEXT_PUBLIC_SUPABASE_URL'],
        '--build-arg', 'NEXT_PUBLIC_SUPABASE_ANON_KEY=' + env['NEXT_PUBLIC_SUPABASE_ANON_KEY'], '.'],
        cwd=stage, stdout=log, stderr=subprocess.STDOUT)
assert result.returncode == 0, 'Build failed; inspect private build.log'
built = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image]))[0]
(stage / 'build.json').write_text(json.dumps({'image': image, 'image_id': built['Id'], 'main_image': old['Image'], 'asset_prefix': '/__account_ui'}))
print('ACCOUNT_FRONTEND_BUILT=' + built['Id'])
