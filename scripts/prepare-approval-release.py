"""Prepare an approval-chain release with an offline restore rehearsal.

Production database access is read-only (catalog queries and pg_dump). SQL writes
are restricted to a disposable network-disabled database. No cutover or apply mode.
Private backup/runtime/log files must not be shared.
"""
import argparse
import ast
import copy
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parent.parent
BACKUP_ROOT = Path('/home/debian/backups')
HATIF_FILE = Path('/home/debian/.config/kohl/hatif.env')
SOURCE = 'f12ad73504dc155eaa990001a3c431fcdeb05f1c'
MIGRATION = '20261112172325_operations_approval_chain.sql'
HASH = '64574fcc8b5348fde6f3af8cd62195076e89f1094a5b7bc223ccea921d952637'
LIVE = {
    'kohl_crm_app': 'sha256:fc2208da1baee389905f1febd4212a11f69be03f45767ceed3e872272a472506',
    'kohl_broker_frontend': 'sha256:b15b68eb3d5127fadc97a2bc8273e1b004ff4073a8202696194912c414dab46f',
    'kohl_account_frontend': 'sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850',
}
spec = importlib.util.spec_from_file_location('offline_restore', ROOT/'scripts/rehearse-operations-restore.py')
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)


def inspect(name, image=False):
    args = ['docker', 'image', 'inspect', name] if image else ['docker', 'inspect', name]
    result = subprocess.run(args, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)[0]


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            value.update(block)
    return value.hexdigest()


def private_json(path, data):
    with path.open('x') as stream:
        os.fchmod(stream.fileno(), 0o600)
        json.dump(data, stream, indent=2)


def candidate_runtime(original, image, env_path):
    # Load only the previously reviewed pure helper, not a historical dispatcher.
    source = (ROOT/'scripts/release-broker-ui.py').read_text()
    node = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef)
                and n.name == 'prepare_hatif_runtime')
    scope = {'copy': copy, 'pathlib': __import__('pathlib')}
    exec(compile(ast.Module(body=[node], type_ignores=[]), 'hatif-preflight', 'exec'), scope)
    candidate = scope['prepare_hatif_runtime'](original, env_path)
    def env(obj):
        return dict(item.split('=', 1) for item in obj['Config'].get('Env', []))
    if env(candidate) != env(original):
        raise RuntimeError('Hatif file differs from live runtime; reconcile privately')
    if original.get('Mounts') or original['Config'].get('Volumes') or original['HostConfig'].get('AutoRemove'):
        raise RuntimeError('Main mounts or auto-remove require separate review')
    candidate['Config']['Image'] = image
    return candidate


def preflight_sql(manager, final):
    manager, final = str(uuid.UUID(manager)), str(uuid.UUID(final))
    if manager == final:
        raise ValueError('Approvers must differ')
    return f"""BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT to_regprocedure('public.kohl_operations(text,jsonb)') IS NOT NULL
 AND to_regprocedure('public.operations_document(uuid,text,jsonb)') IS NOT NULL
 AND to_regclass('portal_private.operations_approval_config') IS NULL
 AND to_regprocedure('portal_private.operations_core_v1(text,jsonb)') IS NULL
 AND to_regprocedure('portal_private.document_core_v1(uuid,text,jsonb)') IS NULL
 AND NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='portal_private'
   AND ((table_name='internal_entries' AND column_name IN ('manager_reviewed_at','manager_reviewed_by','manager_review_note'))
     OR (table_name='leasing_followups' AND column_name IN ('origin','assistant_created_at'))))
 AND EXISTS(SELECT 1 FROM portal_private.accounts WHERE user_id='{manager}' AND role='ADMIN' AND is_active)
 AND EXISTS(SELECT 1 FROM portal_private.accounts WHERE user_id='{final}' AND role='CEO' AND is_active);
ROLLBACK;"""


def snapshot(name, log):
    tables = ['leasing_units', 'leasing_cases', 'leasing_followups', 'internal_dues',
              'internal_installments', 'internal_entries', 'operations_documents',
              'operations_history', 'operations_replays', 'operations_exports']
    pairs = []
    for table in tables:
        key = 'case_id' if table == 'internal_dues' else 'id'
        # Added review/source fields are intentionally excluded on both sides.
        row = "to_jsonb(t)-ARRAY['manager_reviewed_by','manager_reviewed_at','manager_review_note']" if table == 'internal_entries' else (
            "to_jsonb(t)-ARRAY['origin','assistant_created_at']" if table == 'leasing_followups' else 'to_jsonb(t)')
        pairs += ["'"+table+"'", f"(SELECT md5(coalesce(jsonb_agg({row} ORDER BY {key})::text,'[]')) FROM portal_private.{table} t)"]
    return json.loads(restore.query(name, "BEGIN READ ONLY; SET LOCAL statement_timeout='30s'; SELECT jsonb_build_object(" + ','.join(pairs) + '); ROLLBACK;', log))


def verify(name, manager, final, log):
    if not re.fullmatch(r'kohl_restore_review_[0-9a-f]{12}', name):
        raise RuntimeError('Workflow verification requires a disposable restore container')
    restore.verify(name, log)
    statement = """BEGIN READ ONLY;
SELECT NOT EXISTS(SELECT 1 FROM (VALUES ('anon'),('authenticated'),('service_role')) r(role)
 WHERE has_function_privilege(r.role,'portal_private.operations_core_v1(text,jsonb)','EXECUTE')
 OR has_function_privilege(r.role,'portal_private.document_core_v1(uuid,text,jsonb)','EXECUTE')
 OR has_table_privilege(r.role,'portal_private.operations_approval_config','SELECT,INSERT,UPDATE,DELETE'))
 AND (SELECT relrowsecurity FROM pg_class WHERE oid='portal_private.operations_approval_config'::regclass)
 AND NOT EXISTS(SELECT 1 FROM portal_private.internal_entries WHERE manager_reviewed_at IS NOT NULL OR manager_reviewed_by IS NOT NULL OR manager_review_note<>'')
 AND NOT EXISTS(SELECT 1 FROM portal_private.leasing_followups WHERE origin<>'HUMAN' OR assistant_created_at IS NOT NULL);
ROLLBACK;"""
    if restore.query(name, statement, log) != 't':
        raise RuntimeError('Approval privileges or initial review state differ')
    for actor, available in ((manager, True), (final, False)):
        actor = str(uuid.UUID(actor))
        claims = json.dumps({'sub': actor, 'role': 'authenticated'})
        query = f"""BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='{actor}';
SET LOCAL request.jwt.claims='{claims}';
SELECT public.kohl_operations('WORKFLOW_INFO','{{}}');
ROLLBACK;"""
        info = json.loads(restore.query(name, query, log))
        if info['manager_id'] != manager or info['final_id'] != final or info['assistant_available'] is not available:
            raise RuntimeError('Configured reviewer identity or assistant scope differs')


def rehearse(name, archive, roles, manager, final, content, log):
    if not re.fullmatch(r'kohl_restore_review_[0-9a-f]{12}', name):
        raise RuntimeError('SQL writes require a disposable restore container')
    restore.query(name, roles, log)
    restore.restore(name, archive, log)
    print('ISOLATED RESTORE OK', flush=True)
    if restore.query(name, preflight_sql(manager, final), log) != 't':
        raise RuntimeError('Restored schema/accounts differ from approval prerequisites')
    before = snapshot(name, log)
    manager, final = str(uuid.UUID(manager)), str(uuid.UUID(final))
    settings = f"SET statement_timeout='60s'; SET kohl.workflow_manager='{manager}'; SET kohl.workflow_final='{final}';\n"
    restore.query(name, settings + content, log)
    verify(name, manager, final, log)
    if snapshot(name, log) != before:
        raise RuntimeError('Existing business records changed during isolated migration')
    print('ISOLATED APPROVAL MIGRATION, PERMISSIONS AND DATA PRESERVATION OK', flush=True)
    return before


def prepare(args):
    os.umask(0o077)
    manager, final = str(uuid.UUID(args.manager)), str(uuid.UUID(args.final))
    preflight = preflight_sql(manager, final)
    content = (ROOT/'supabase/migrations'/MIGRATION).read_text()
    if hashlib.sha256(content.encode()).hexdigest() != HASH:
        raise RuntimeError('Approval migration differs from the tested version')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', args.app_image):
        raise RuntimeError('Candidate must be an exact image ID')
    built = inspect(args.app_image, image=True)
    if built['Id'] != args.app_image or (built['Config'].get('Labels') or {}).get('org.opencontainers.image.revision') != SOURCE:
        raise RuntimeError('Image source label does not match the accepted application')
    originals = {name: inspect(name) for name in LIVE}
    for name, original in originals.items():
        if original['Image'] != LIVE[name] or not original['State']['Running']:
            raise RuntimeError('Live image changed or stopped; review before preparation')
    database_image = inspect('supabase-db')['Image']
    if database_image != restore.IMAGE:
        raise RuntimeError('Database image changed; review restore compatibility')
    env_path = HATIF_FILE
    runtime = candidate_runtime(originals['kohl_crm_app'], args.app_image, env_path)
    base = BACKUP_ROOT
    base.mkdir(parents=True, exist_ok=True)
    folder = Path(tempfile.mkdtemp(prefix='kohl-approval-plan-', dir=base))
    stage = 'read-only preflight'
    try:
        with (folder/'private.log').open('xb') as log:
            if restore.query('supabase-db', preflight, log) != 't':
                raise RuntimeError('Live schema/accounts differ from prerequisites')
            size = int(restore.query('supabase-db', "BEGIN READ ONLY; SELECT pg_database_size(current_database()); ROLLBACK;", log))
            if shutil.disk_usage(base).free < size*2 + 2*1024**3:
                raise RuntimeError('Insufficient disk for backup and restore')
            available = next(int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
            if available < 2*1024**3:
                raise RuntimeError('At least 2 GiB available RAM required for rehearsal')
            roles = restore.query('supabase-db', restore.ROLE_SQL, log)
            stage = 'fresh backup'
            partial = folder/'postgres.dump.incomplete'
            with partial.open('xb') as stream:
                restore.run(['docker', 'exec', 'supabase-db', 'pg_dump', '-U', 'postgres', '-Fc', '--lock-wait-timeout=15s', 'postgres'], log, stdout=stream)
            if partial.stat().st_size == 0:
                raise RuntimeError('Backup is empty')
            with partial.open('rb') as stream:
                restore.run(['docker', 'exec', '-i', 'supabase-db', 'pg_restore', '--list'], log, stdin=stream, stdout=log)
            archive = folder/'postgres.dump'
            partial.rename(archive)
            print('FRESH PRIVATE BACKUP ARCHIVE OK', flush=True)
            stage = 'offline restore and approval rehearsal'
            with restore.sandbox(database_image, log) as name:
                fingerprints = rehearse(name, archive, roles, manager, final, content, log)
            stage = 'runtime recheck'
            for name, original in originals.items():
                current = inspect(name)
                if any(current[key] != original[key] for key in ('Id', 'Image', 'Config', 'HostConfig')) or not current['State']['Running'] or current['State']['StartedAt'] != original['State']['StartedAt']:
                    raise RuntimeError('Live runtime changed during preparation')
            if candidate_runtime(inspect('kohl_crm_app'), args.app_image, env_path) != runtime:
                raise RuntimeError('Hatif/runtime changed during preparation')
            private_json(folder/'runtime-original.private.json', originals)
            private_json(folder/'runtime-candidate.private.json', runtime)
            private_json(folder/'plan.private.json', {
                'mode': 'PREPARE_ONLY', 'application_source': SOURCE, 'image': args.app_image,
                'migration': MIGRATION, 'migration_sha256': HASH,
                'manager_id': manager, 'final_id': final, 'previous_images': LIVE,
                'database_image': database_image, 'backup': str(archive), 'backup_sha256': digest(archive),
                'rehearsal_fingerprints': fingerprints, 'production_changed': False,
                'created_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'hatif_file_matches_live': True,
                'http_acceptance': 'Operator reported successful exact-image synthetic HTTP approval test; image ID supplied by operator',
                'fresh_backup_required_at_cutover': True,
                'cutover_dispatcher': 'Not included; do not use the historical release dispatcher',
            })
        print('APPROVAL PREPARATION OK; Hatif preserved; production unchanged.')
        print('Candidate image: ' + args.app_image)
        print('Private plan directory: ' + str(folder))
        print('Do not share private logs, backups or runtime/plan JSON files.')
    except Exception:
        print('STOP: approval preparation failed at ' + stage)
        print('Private diagnostics: ' + str(folder/'private.log') + '; do not paste raw logs.')
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app-image', required=True)
    parser.add_argument('--manager', required=True)
    parser.add_argument('--final', required=True)
    args = parser.parse_args()
    try:
        prepare(args)
    except Exception as error:
        print('No production migration/cutover performed. Failure type: ' + type(error).__name__)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
