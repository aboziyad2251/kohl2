"""Pinned availability build, exact-image test and offline backup rehearsal. NO APPLY."""
import argparse
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'a63cba7609ee1e78ee78c7dc38c50eec29fdded7'
MIGRATIONS = {
    '20261122073344_leasing_availability_and_reservations.sql': '35d667e1474b14090b083c5022f6c7f250672feb5f1c68c7ee23f58ea1188bd2',
    '20261122073458_leasing_followup_categories.sql': '1bac0c7d3c4f12f951ed48ad4dc3568b54d31cd7be4f2d962d23f690b1ca9f9b',
}
LIVE = {
    'kohl_crm_app': 'sha256:bdc7734c1dacfa8cc32a71de0c272da46f2576504d0e768c36d1cf8ca1a6317a',
    'kohl_broker_frontend': 'sha256:b15b68eb3d5127fadc97a2bc8273e1b004ff4073a8202696194912c414dab46f',
    'kohl_account_frontend': 'sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850',
}
BACKUPS = Path('/home/debian/backups')
spec = importlib.util.spec_from_file_location('inert_availability_helpers', ROOT / 'scripts/prepare-leasing-specialist-release.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
# Only pure/runtime/build helpers; never invoke historical prepare/apply/verify paths.
base.SOURCE = SOURCE
restore = base.restore


def isolated(name):
    if not re.fullmatch(r'kohl_restore_review_[0-9a-f]{12}', name):
        raise RuntimeError('Writes require a disposable restore container')


def read(name, sql, log):
    if name != 'supabase-db':
        isolated(name)
    return restore.query(name, "BEGIN READ ONLY; SET LOCAL statement_timeout='30s';\n" + sql + '\nROLLBACK;', log)


def checkpoint():
    originals = {name: base.inspect(name) for name in LIVE}
    if any(obj['Image'] != LIVE[name] or not obj['State']['Running'] for name, obj in originals.items()):
        raise RuntimeError('Live image checkpoint changed')
    if base.inspect('supabase-db')['Image'] != restore.IMAGE:
        raise RuntimeError('Database image checkpoint changed')
    if base.env(originals['kohl_account_frontend']).get('PASSWORD_RECOVERY_ENABLED') != 'false':
        raise RuntimeError('Account recovery must remain disabled')
    base.candidate_runtime(originals['kohl_crm_app'], LIVE['kohl_crm_app'])
    return originals


def migration_sql():
    parts = []
    for name, expected in MIGRATIONS.items():
        path = ROOT / 'supabase/migrations' / name
        if base.digest(path) != expected:
            raise RuntimeError('Pinned migration differs')
        source = path.read_text()
        parts.append(source[source.index('begin;') + 6:source.rindex('commit;')])
    # Both migrations succeed or both roll back; no production execution entry point.
    return "BEGIN; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='60s';\n" + '\n'.join(parts) + '\nCOMMIT;'


PREREQUISITES = """SELECT json_build_object(
 'availability_absent',to_regclass('portal_private.leasing_holds') IS NULL,
 'category_absent',NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='portal_private' AND table_name='leasing_followups' AND column_name='category'),
 'specialist_present',to_regprocedure('portal_private.leasing_scope()') IS NOT NULL,
 'reviewers_active',EXISTS(SELECT 1 FROM portal_private.operations_approval_config c
  JOIN portal_private.accounts m ON m.user_id=c.manager_id AND m.role='ADMIN' AND m.is_active
  JOIN portal_private.accounts f ON f.user_id=c.final_id AND f.role='CEO' AND f.is_active WHERE c.singleton)
);"""


def preflight(name, log):
    flags = json.loads(read(name, PREREQUISITES, log))
    if not flags or any(value is not True for value in flags.values()):
        raise RuntimeError('Availability database prerequisites differ')


def snapshot(name, log, tables=None):
    isolated(name)
    if tables is None:
        tables = json.loads(read(name, """SELECT coalesce(json_agg(json_build_array(n.nspname,c.relname) ORDER BY n.nspname,c.relname),'[]'::json)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','portal_private','auth','storage') AND c.relkind IN ('r','p');""", log))
    result = {}
    for schema, table in tables:
        ident = '.'.join('"' + value.replace('"', '""') + '"' for value in (schema, table))
        row = 'to_jsonb(t)'
        if (schema, table) == ('portal_private', 'leasing_cases'):
            row += "-'booking_cancelled_at'-'booking_cancelled_by'"
        if (schema, table) == ('portal_private', 'leasing_followups'):
            row += "-'category'"
        result[schema + '.' + table] = read(name, "SELECT md5(coalesce(jsonb_agg(" + row + ' ORDER BY (' + row + ")::text)::text,'[]')) FROM " + ident + ' t;', log)
    return tables, result


VERIFY = """SELECT
 NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('reserve_leasing_unit','extend_leasing_hold','leasing_reservation_status','cancel_leasing_booking','leasing_unit_availability','save_leasing_unit_specs','link_leasing_contract_unit')
  AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE')))
 AND (SELECT count(*)=7 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
  AND p.proname IN ('reserve_leasing_unit','extend_leasing_hold','leasing_reservation_status','cancel_leasing_booking','leasing_unit_availability','save_leasing_unit_specs','link_leasing_contract_unit')
  AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""'] AND has_function_privilege('authenticated',p.oid,'EXECUTE'))
 AND NOT EXISTS(SELECT 1 FROM pg_class c CROSS JOIN (VALUES ('anon'),('authenticated'),('kohl_leasing'),('service_role')) r(role)
  WHERE c.oid IN ('portal_private.leasing_holds'::regclass,'portal_private.leasing_unit_specs'::regclass,'portal_private.leasing_contract_units'::regclass)
  AND (NOT c.relrowsecurity OR has_table_privilege(r.role,c.oid,'SELECT,INSERT,UPDATE,DELETE')))
 AND has_function_privilege('kohl_leasing','public.reserve_leasing_unit(uuid,uuid,date,date)','EXECUTE')
 AND has_function_privilege('kohl_leasing','public.leasing_reservation_status()','EXECUTE')
 AND has_function_privilege('kohl_leasing','public.leasing_unit_availability(date,date)','EXECUTE')
 AND NOT has_function_privilege('kohl_leasing','public.cancel_leasing_booking(uuid)','EXECUTE')
 AND NOT has_function_privilege('kohl_leasing','public.extend_leasing_hold(uuid,text)','EXECUTE')
 AND NOT has_function_privilege('kohl_leasing','public.save_leasing_unit_specs(uuid,integer,integer)','EXECUTE')
 AND NOT has_function_privilege('kohl_leasing','public.link_leasing_contract_unit(uuid,uuid)','EXECUTE')
 AND NOT EXISTS(SELECT 1 FROM portal_private.leasing_holds)
 AND NOT EXISTS(SELECT 1 FROM portal_private.leasing_contract_units)
 AND NOT EXISTS(SELECT 1 FROM portal_private.leasing_unit_specs)
 AND NOT EXISTS(SELECT 1 FROM portal_private.leasing_cases WHERE booking_cancelled_at IS NOT NULL OR booking_cancelled_by IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM portal_private.leasing_followups WHERE category<>'GENERAL')
 AND (SELECT count(*)=2 FROM pg_trigger WHERE tgname IN ('leasing_confirmation_guard','leasing_contract_guard') AND NOT tgisinternal AND tgenabled='O');"""


def rehearse(name, archive, roles, log):
    isolated(name)
    content = migration_sql()  # Validate before any restore writes.
    restore.query(name, roles, log)
    restore.restore(name, archive, log)
    preflight(name, log)
    tables, before = snapshot(name, log)
    restore.query(name, content, log)
    restore.verify(name, log)
    if read(name, VERIFY, log) != 't':
        raise RuntimeError('Availability privileges or initial state differ')
    if snapshot(name, log, tables)[1] != before:
        raise RuntimeError('Existing restored data changed')
    print('ISOLATED RESTORE, BOTH MIGRATIONS, PERMISSIONS AND DATA PRESERVATION OK', flush=True)
    return before


def validate_receipt(path, image):
    receipt = json.loads(path.read_text())
    if (receipt.get('passed') is not True or receipt.get('production_changed') is not False
            or receipt.get('image') != image or receipt.get('availability') is not True
            or receipt.get('availability_migrations') != MIGRATIONS
            or receipt.get('test_script_sha256') != base.digest(ROOT / 'scripts/test-leasing-switch.py')):
        raise RuntimeError('Exact-image availability acceptance receipt differs')


def prepare(app_image=None):
    os.umask(0o077)
    if base.pre.output(['git', '-C', str(ROOT), 'status', '--porcelain', '--untracked-files=no']):
        raise RuntimeError('Tracked source changes require review')
    migration_sql()
    # Test code must be the same tested code included in the pinned application source.
    test_source = subprocess.check_output(['git', '-C', str(ROOT), 'show', SOURCE + ':scripts/test-leasing-switch.py'])
    if hashlib.sha256(test_source).hexdigest() != base.digest(ROOT / 'scripts/test-leasing-switch.py'):
        raise RuntimeError('HTTP test differs from pinned source')
    originals = checkpoint()
    BACKUPS.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(BACKUPS).free < 4 * 1024**3:
        raise RuntimeError('At least 4 GiB free disk required')
    memory = next(int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
    if memory < 2 * 1024**3:
        raise RuntimeError('At least 2 GiB available RAM required')
    with (BACKUPS / '.kohl-operations-release.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        folder = Path(tempfile.mkdtemp(prefix='kohl-availability-plan-', dir=BACKUPS))
        print('Private preparation directory: ' + str(folder), flush=True)
        stage = 'read-only preflight'
        try:
            with (folder / 'private.log').open('xb') as log:
                preflight('supabase-db', log)
                stage = 'pinned image build'
                print('BUILDING PINNED AVAILABILITY IMAGE; live app remains running.', flush=True)
                image = app_image or base.build(folder, originals['kohl_crm_app'], log)
                if not re.fullmatch(r'sha256:[0-9a-f]{64}', image):
                    raise RuntimeError('Exact candidate image required')
                built = base.inspect(image, True)
                if built['Id'] != image or (built['Config'].get('Labels') or {}).get('org.opencontainers.image.revision') != SOURCE:
                    raise RuntimeError('Candidate image source differs')
                stage = 'exact-image acceptance'
                receipt = folder / 'http-receipt.private.json'
                subprocess.run([sys.executable, '-B', str(ROOT / 'scripts/test-leasing-switch.py'), '--availability', '--app-image', image, '--receipt', str(receipt)], check=True, stdout=log, stderr=log, timeout=900)
                validate_receipt(receipt, image)
                print('EXACT IMAGE AVAILABILITY HTTP ACCEPTANCE OK', flush=True)
                runtime = base.candidate_runtime(originals['kohl_crm_app'], image)
                stage = 'fresh private backup'
                size = int(read('supabase-db', 'SELECT pg_database_size(current_database());', log))
                if shutil.disk_usage(BACKUPS).free < size * 2 + 2 * 1024**3:
                    raise RuntimeError('Insufficient backup/restore space')
                roles = restore.query('supabase-db', restore.ROLE_SQL, log)
                roles_path = folder / 'roles.private.sql'
                with roles_path.open('x') as stream:
                    os.fchmod(stream.fileno(), 0o600)
                    stream.write(roles)
                partial = folder / 'postgres.dump.incomplete'
                with partial.open('xb') as stream:
                    restore.run(['docker', 'exec', 'supabase-db', 'pg_dump', '-U', 'postgres', '-Fc', '--lock-wait-timeout=15s', 'postgres'], log, stdout=stream)
                if not partial.stat().st_size:
                    raise RuntimeError('Empty backup')
                with partial.open('rb') as stream:
                    restore.run(['docker', 'exec', '-i', 'supabase-db', 'pg_restore', '--list'], log, stdin=stream, stdout=log)
                archive = folder / 'postgres.dump'
                partial.rename(archive)
                print('FRESH PRIVATE BACKUP ARCHIVE OK', flush=True)
                stage = 'offline restore rehearsal'
                with restore.sandbox(restore.IMAGE, log) as name:
                    fingerprints = rehearse(name, archive, roles, log)
                stage = 'live runtime recheck'
                current = checkpoint()
                for name, original in originals.items():
                    if any(current[name][key] != original[key] for key in ('Id', 'Image', 'Config', 'HostConfig', 'NetworkSettings')):
                        raise RuntimeError('Live runtime changed during preparation')
                    if not current[name]['State']['Running'] or current[name]['State']['StartedAt'] != original['State']['StartedAt']:
                        raise RuntimeError('Live container restarted during preparation')
                if base.candidate_runtime(current['kohl_crm_app'], image) != runtime:
                    raise RuntimeError('Hatif/runtime changed')
                base.private_json(folder / 'runtime-original.private.json', originals)
                base.private_json(folder / 'runtime-candidate.private.json', runtime)
                base.private_json(folder / 'plan.private.json', {
                    'mode': 'PREPARE_ONLY', 'application_source': SOURCE, 'image': image,
                    'migrations': MIGRATIONS, 'previous_images': LIVE, 'database_image': restore.IMAGE,
                    'backup': str(archive), 'backup_sha256': base.digest(archive),
                    'roles_file': str(roles_path), 'roles_sha256': base.digest(roles_path),
                    'rehearsal_fingerprints': fingerprints, 'http_receipt_sha256': base.digest(receipt),
                    'hatif_matches_live': True, 'account_recovery_disabled': True, 'production_changed': False,
                    'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'fresh_backup_required_at_cutover': True, 'cutover_dispatcher': 'Not included; do not use historical dispatchers',
                })
            print('AVAILABILITY PREPARATION OK; Hatif preserved; recovery disabled; production unchanged.')
            print('Candidate image: ' + image)
            print('Private plan directory: ' + str(folder))
            print('No deployment performed. Do not share backups, runtime JSON or private logs.')
        except Exception:
            print('STOP: availability preparation failed at ' + stage)
            print('Private diagnostics: ' + str(folder / 'private.log') + '; do not paste raw logs.')
            raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app-image', help='Reuse a pinned-source image, with fresh acceptance and backup')
    args = parser.parse_args()
    try:
        prepare(args.app_image)
    except Exception as error:
        raise SystemExit('No production migration or cutover performed. Failure type: ' + type(error).__name__)
