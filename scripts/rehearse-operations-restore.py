"""Private, offline restore rehearsal. Never applies SQL to the production database.

Production access is restricted to a fixed read-only pg_roles/pg_auth_members query
and Docker image inspection. Restore and migration commands target a newly created,
network-disabled container. Logs may contain private data: never share their contents.
"""
import argparse
import contextlib
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import uuid

IMAGE = 'sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00'
ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = (
    '20261110143135_leasing_internal_finance.sql',
    '20261110215449_operations_private_documents.sql',
)
EXPECTED_HASHES = {'20261110143135_leasing_internal_finance.sql': '2e06978ae1d99008078a06ddc204de03141ba51f18fb2bb3618d7dd0dd7de973', '20261110215449_operations_private_documents.sql': '0d8991c38959904919e77293195ac0ec1ba94217b9b5f63c837167a7ba0ecd9a'}
ROLE_SQL = """
BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT format('CREATE ROLE %I WITH NOLOGIN %s %s %s %s %s;',
 rolname, CASE WHEN rolsuper THEN 'SUPERUSER' ELSE 'NOSUPERUSER' END,
 CASE WHEN rolinherit THEN 'INHERIT' ELSE 'NOINHERIT' END,
 CASE WHEN rolcreatedb THEN 'CREATEDB' ELSE 'NOCREATEDB' END,
 CASE WHEN rolcreaterole THEN 'CREATEROLE' ELSE 'NOCREATEROLE' END,
 CASE WHEN rolbypassrls THEN 'BYPASSRLS' ELSE 'NOBYPASSRLS' END)
FROM pg_roles WHERE rolname !~ '^pg_' AND rolname <> 'postgres';
SELECT format('GRANT %I TO %I WITH ADMIN %s, INHERIT %s, SET %s;',
 r.rolname, m.rolname,
 CASE WHEN a.admin_option THEN 'TRUE' ELSE 'FALSE' END,
 CASE WHEN a.inherit_option THEN 'TRUE' ELSE 'FALSE' END,
 CASE WHEN a.set_option THEN 'TRUE' ELSE 'FALSE' END)
FROM pg_auth_members a
JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member;
ROLLBACK;
"""

def run(args, log, **kwargs):
    return subprocess.run(args, check=True, stderr=log, **kwargs)

def query(name, statement, log):
    result = run(['docker', 'exec', '-i', name, 'psql', '-X', '-qAt',
                  '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
                 log, input=statement.encode(), stdout=subprocess.PIPE)
    return result.stdout.decode().strip()

@contextlib.contextmanager
def sandbox(image, log):
    name = 'kohl_restore_review_' + uuid.uuid4().hex[:12]
    # Override the image entrypoint: no Supabase startup/migration scripts or
    # production volumes/env/config are copied into this disposable cluster.
    boot = """
set -eu
bin="$(pg_config --bindir)"
"$bin/initdb" -D /review/data -U postgres --encoding=UTF8 --locale=en_US.UTF-8 --auth-local=trust --auth-host=reject >/dev/null
exec "$bin/postgres" -D /review/data -k /review -c listen_addresses='' -c shared_preload_libraries='pg_stat_statements,pg_net,supabase_vault'
"""
    created = False
    try:
        run(['docker', 'create', '--pull', 'never', '--name', name,
             '--network', 'none', '--user', 'postgres',
             '--memory', '1g', '--cpus', '1', '--pids-limit', '256',
             '--tmpfs', '/review:rw,mode=1777,size=2g',
             '-e', 'PGHOST=/review', '--entrypoint', '/bin/sh',
             image, '-ec', boot], log, stdout=log)
        created = True
        run(['docker', 'start', name], log, stdout=log)
        for _ in range(60):
            result = subprocess.run(['docker', 'exec', name, 'pg_isready',
                                     '-h', '/review', '-U', 'postgres'],
                                    stdout=subprocess.DEVNULL, stderr=log)
            if result.returncode == 0:
                break
            time.sleep(.5)
        else:
            run(['docker', 'logs', name], log, stdout=log)
            raise RuntimeError('isolated database startup failed')
        yield name
    finally:
        if created:
            run(['docker', 'rm', '-f', '-v', name], log, stdout=log)

def restore(name, archive, log):
    with archive.open('rb') as source:
        run(['docker', 'exec', '-i', name, 'pg_restore', '-U', 'postgres',
             '-d', 'postgres', '--exit-on-error', '--single-transaction'],
            log, stdin=source, stdout=log)

def verify(name, log):
    statement = """
BEGIN READ ONLY;
SELECT to_regprocedure('public.kohl_operations(text,jsonb)') IS NOT NULL
 AND to_regprocedure('public.operations_document(uuid,text,jsonb)') IS NOT NULL
 AND NOT has_function_privilege('anon','public.kohl_operations(text,jsonb)','EXECUTE')
 AND has_function_privilege('authenticated','public.kohl_operations(text,jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.operations_document(uuid,text,jsonb)','EXECUTE')
 AND has_function_privilege('service_role','public.operations_document(uuid,text,jsonb)','EXECUTE')
 AND EXISTS(SELECT 1 FROM storage.buckets WHERE id='kohl-finance-documents'
            AND NOT public AND file_size_limit=5242880)
 AND EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage'
            AND tablename='objects' AND policyname='kohl_finance_no_browser_access'
            AND permissive='RESTRICTIVE')
 AND NOT has_table_privilege('authenticated','portal_private.operations_documents','SELECT');
ROLLBACK;
"""
    if query(name, statement, log) != 't':
        raise RuntimeError('candidate privilege verification failed')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backup', required=True, type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    for filename, expected in EXPECTED_HASHES.items():
        if hashlib.sha256((ROOT / 'supabase/migrations' / filename).read_bytes()).hexdigest() != expected:
            raise SystemExit('STOP: candidate migration differs from reviewed version')
    archive = args.backup.resolve(strict=True)
    if not archive.is_file() or archive.stat().st_size == 0:
        raise RuntimeError('backup missing or empty')
    folder = archive.parent / ('rehearsal-' + datetime.datetime.now(
        datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(mode=0o700)
    stage = 'preflight'
    try:
        with (folder / 'private.log').open('xb') as log:
            image = run(['docker', 'inspect', 'supabase-db', '--format', '{{.Image}}'],
                        log, stdout=subprocess.PIPE).stdout.decode().strip()
            if image != IMAGE:
                raise RuntimeError('production database image differs from reviewed image')
            with archive.open('rb') as source:
                run(['docker', 'exec', '-i', 'supabase-db', 'pg_restore', '--list'],
                    log, stdin=source, stdout=log)
            # Role attributes and memberships only; no password hashes.
            roles = query('supabase-db', ROLE_SQL, log)
            migration_hashes = {}
            with sandbox(image, log) as name:
                stage = 'roles'
                query(name, roles, log)
                stage = 'restore'
                restore(name, archive, log)
                print('ISOLATED RESTORE OK', flush=True)
                for migration in MIGRATIONS:
                    stage = migration
                    content = (ROOT / 'supabase/migrations' / migration).read_bytes()
                    migration_hashes[migration] = hashlib.sha256(content).hexdigest()
                    query(name, content.decode(), log)
                    print('ISOLATED MIGRATION OK: ' + migration, flush=True)
                stage = 'permissions'
                verify(name, log)
                print('ISOLATED DATABASE PERMISSIONS OK', flush=True)
            receipt = {'image': image, 'backup': str(archive),
                       'migrations': migration_hashes, 'production_changed': False,
                       'scope': 'Database restore, migrations and SQL privilege checks only; not Auth/Storage HTTP integration.'}
            (folder / 'receipt.json').write_text(json.dumps(receipt, indent=2))
        print('REHEARSAL PASSED; temporary database removed; production unchanged.')
        print('Private receipt: ' + str(folder / 'receipt.json'))
    except Exception:
        print('STOP: rehearsal failed at ' + stage)
        print('Private diagnostics: ' + str(folder / 'private.log'))
        print('Do not paste the log: it may contain private database contents.')
        raise SystemExit(1)

if __name__ == '__main__':
    main()
