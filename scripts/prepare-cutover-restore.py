"""VPS operator: fresh private backup + a NEW isolated full restore, no live writes."""
import datetime, json, os, pathlib, subprocess

os.umask(0o077)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
folder = pathlib.Path('/home/debian/backups') / ('kohl-cutover-' + stamp)
folder.mkdir(mode=0o700)
database = 'kohl_cutover_' + stamp.lower()
def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, **kwargs)
    if result.returncode:
        (folder / 'failure.log').write_bytes(result.stderr)
        raise RuntimeError('Backup/restore command failed; private failure.log saved')
    return result
with (folder / 'postgres.dump').open('wb') as out:
    result = subprocess.run(['docker','exec','supabase-db','pg_dump','-U','supabase_admin','-d','postgres','-Fc'], stdout=out, stderr=subprocess.PIPE)
    if result.returncode: raise RuntimeError('Production backup failed')
run(['tar','-czf',str(folder/'config-and-app.tar.gz'),'-C','/home/debian','projects/kohl-crm-app','supabase/docker/.env','supabase/docker/docker-compose.yml','supabase/docker/volumes/api'])
storage = pathlib.Path('/home/debian/supabase/docker/volumes/storage')
if storage.exists():run(['tar','-czf',str(folder/'storage.tar.gz'),'-C',str(storage),'.'])
run(['docker','exec','supabase-db','createdb','-U','supabase_admin','-T','template0',database])
with (folder/'postgres.dump').open('rb') as backup:
    run(['docker','exec','-i','supabase-db','pg_restore','-U','supabase_admin','-d',database,'--exit-on-error'],stdin=backup)
query="select (select count(*) from public.lessors),(select count(*) from public.ownership_documents),(select count(*) from auth.users);"
counts=[]
for db in ['postgres',database]:
    counts.append(run(['docker','exec','supabase-db','psql','-X','-U','postgres','-d',db,'-At','-c',query]).stdout.decode().strip())
assert counts[0] == counts[1], 'Restored counts differ'
(folder/'checkpoint.json').write_text(json.dumps({'database':database,'backup':str(folder),'restore_verified':True},indent=2))
print(json.dumps({'database':database,'backup':str(folder),'restore_verified':True,'counts':counts[0]}))
