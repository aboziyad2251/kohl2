"""Transactional portal acceptance on the existing isolated test database."""
import json, pathlib, subprocess
from urllib.parse import urlparse
stage=pathlib.Path('/home/debian/projects/kohl-portals-release')
env=dict(x.split('=',1) for x in json.loads(subprocess.check_output(['docker','inspect','kohl-cutover-preview-rest']))[0]['Config']['Env'] if '=' in x)
db=urlparse(env['PGRST_DB_URI']).path.lstrip('/')
assert db.startswith('kohl_cutover_') and db!='postgres'
source=(stage/'supabase/migrations/20261005161549_role_portal_workflows.sql').read_text().rsplit('commit;',1)[0]
source+=(stage/'scripts/test-portal-workflows.sql').read_text()+'\nrollback;'
result=subprocess.run(['docker','exec','-i','supabase-db','psql','-X','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],input=source.encode(),capture_output=True)
print(result.stderr.decode())
assert result.returncode==0
print('Isolated database tests passed; all fixtures and schema changes rolled back')
