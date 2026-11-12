"""Preparation boundaries and an optional PostgreSQL dump/restore rehearsal fixture."""
import contextlib
import copy
import importlib.util
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('approval_preparation', ROOT/'scripts/prepare-approval-release.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
sys.path.insert(0, str(ROOT/'scripts'))
from postgres_test_runtime import wait_for_postgres

MANAGER = '11111111-1111-4111-8111-111111111111'
FINAL = '22222222-2222-4222-8222-222222222222'
IMAGE = 'postgres@sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac'


class Boundaries(unittest.TestCase):
    def test_rehearsal_refuses_production_before_any_commands(self):
        for name in ('supabase-db', 'kohl_crm_app', 'kohl_restore_review_invalid'):
            with patch.object(mod.restore, 'query') as query:
                with self.assertRaisesRegex(RuntimeError, 'disposable'):
                    mod.rehearse(name, Path('/not-read'), '', MANAGER, FINAL, '', io.BytesIO())
                query.assert_not_called()

    def test_account_input_is_validated_before_sql(self):
        with self.assertRaises(ValueError):
            mod.preflight_sql("'; DROP TABLE accounts;--", FINAL)
        with self.assertRaises(ValueError):
            mod.preflight_sql(MANAGER, MANAGER)
        sql = mod.preflight_sql(MANAGER, FINAL)
        self.assertTrue(sql.startswith('BEGIN READ ONLY;'))
        self.assertTrue(sql.endswith('ROLLBACK;'))

    def test_preserves_runtime_and_rejects_rotated_hatif_file(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'hatif.env'
            settings = ['HATIF_ENABLED=true', 'HATIF_CLIENT_ID=fixture',
                        'HATIF_CLIENT_SECRET=fixture-only', 'HATIF_WEBHOOK_SECRET='+'a'*25]
            path.write_text('\n'.join(settings))
            original = {'Config': {'Image': 'old', 'Env': ['OTHER=kept'] + settings},
                        'HostConfig': {'NetworkMode': 'fixture'}, 'Mounts': []}
            saved = copy.deepcopy(original)
            result = mod.candidate_runtime(original, 'new', path)
            self.assertEqual(original, saved)
            self.assertEqual(result['Config']['Image'], 'new')
            self.assertEqual(set(result['Config']['Env']), set(original['Config']['Env']))
            path.write_text('\n'.join(settings).replace('a'*25, 'b'*25))
            with self.assertRaisesRegex(RuntimeError, 'differs'):
                mod.candidate_runtime(original, 'new', path)


    def test_preparation_only_reads_production_and_keeps_private_artifacts(self):
        import argparse
        from contextlib import ExitStack, redirect_stdout
        candidate = 'sha256:' + 'a'*64
        settings = ['HATIF_ENABLED=true', 'HATIF_CLIENT_ID=fixture',
                    'HATIF_CLIENT_SECRET=fixture-private', 'HATIF_WEBHOOK_SECRET='+'z'*25]
        originals = {name: {'Id':name, 'Image':image, 'State':{'Running':True,'StartedAt':'fixture'},
                           'Config':{'Env':settings,'Image':'old'}, 'HostConfig':{}, 'Mounts':[]}
                     for name,image in mod.LIVE.items()}
        calls = []
        def inspect(name, image=False):
            if image:
                return {'Id':candidate,'Config':{'Labels':{'org.opencontainers.image.revision':mod.SOURCE}}}
            if name == 'supabase-db':
                return {'Image':mod.restore.IMAGE}
            return copy.deepcopy(originals[name])
        def query(name, text, log):
            self.assertEqual(name, 'supabase-db')
            self.assertTrue(text.lstrip().startswith('BEGIN READ ONLY;'))
            self.assertTrue(text.rstrip().endswith('ROLLBACK;'))
            calls.append(('query', text))
            return '10' if 'pg_database_size' in text else ('roles-fixture' if text == mod.restore.ROLE_SQL else 't')
        def run(args, log, **kwargs):
            self.assertEqual(args[:3], ['docker','exec','supabase-db'] if args[2] != '-i' else ['docker','exec','-i'])
            self.assertTrue('pg_dump' in args or 'pg_restore' in args)
            if 'pg_restore' in args:
                self.assertIn('--list', args)
            else:
                kwargs['stdout'].write(b'Synthetic private backup')
            calls.append(('run', args))
            return subprocess.CompletedProcess(args, 0)
        @contextlib.contextmanager
        def sandbox(image, log):
            self.assertEqual(image, mod.restore.IMAGE)
            yield 'kohl_restore_review_123456789abc'
        with tempfile.TemporaryDirectory() as folder, ExitStack() as stack:
            base = Path(folder)/'backups'
            env = Path(folder)/'hatif.env'; env.write_text('\n'.join(settings))
            stack.enter_context(patch.object(mod, 'BACKUP_ROOT', base))
            stack.enter_context(patch.object(mod, 'HATIF_FILE', env))
            stack.enter_context(patch.object(mod, 'inspect', side_effect=inspect))
            stack.enter_context(patch.object(mod.restore, 'query', side_effect=query))
            stack.enter_context(patch.object(mod.restore, 'run', side_effect=run))
            stack.enter_context(patch.object(mod.restore, 'sandbox', side_effect=sandbox))
            rehearsal = stack.enter_context(patch.object(mod, 'rehearse', return_value={'fixture':'hash'}))
            capture = stack.enter_context(redirect_stdout(io.StringIO()))
            mod.prepare(argparse.Namespace(app_image=candidate, manager=MANAGER, final=FINAL))
            target = next(base.iterdir())
            plan = __import__('json').loads((target/'plan.private.json').read_text())
            self.assertEqual(plan['mode'], 'PREPARE_ONLY')
            self.assertFalse(plan['production_changed'])
            self.assertEqual(plan['image'], candidate)
            self.assertEqual(plan['manager_id'], MANAGER)
            self.assertEqual(plan['migration_sha256'], mod.HASH)
            self.assertTrue(plan['hatif_file_matches_live'])
            self.assertEqual((target/'postgres.dump').stat().st_mode & 0o777, 0o600)
            self.assertEqual((target/'runtime-original.private.json').stat().st_mode & 0o777, 0o600)
            self.assertEqual(target.stat().st_mode & 0o777, 0o700)
            self.assertNotIn('fixture-private', capture.getvalue())
            self.assertNotIn(MANAGER, capture.getvalue())
            self.assertEqual(rehearsal.call_args.args[0], 'kohl_restore_review_123456789abc')
            self.assertEqual(len([c for c in calls if c[0]=='run']), 2)


@contextlib.contextmanager
def isolated(log):
    name = 'kohl_restore_review_' + uuid.uuid4().hex[:12]
    created = False
    try:
        mod.restore.run(['docker', 'create', '--pull', 'never', '--name', name,
                         '--network', 'none', '--memory', '512m', '--cpus', '1',
                         '--tmpfs', '/var/lib/postgresql/data:rw,size=256m',
                         '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE], log, stdout=log)
        created = True
        mod.restore.run(['docker', 'start', name], log, stdout=log)
        wait_for_postgres(name)
        yield name
    finally:
        if created:
            mod.restore.run(['docker', 'rm', '-f', '-v', name], log, stdout=log)


def integration():
    with tempfile.TemporaryDirectory() as folder:
        archive = Path(folder)/'fixture.dump'
        with (Path(folder)/'private.log').open('w+b') as log:
            try:
                with isolated(log) as source:
                    mod.restore.query(source, f"""
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA portal_private; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TABLE portal_private.accounts(user_id uuid primary key,full_name text,role text,is_active boolean,employee_id uuid);
CREATE TABLE public.properties(id uuid primary key,property_name text);
CREATE TABLE public.crm_leads(id uuid primary key,name text,phone text,source text,assigned_agent_id uuid);
CREATE TABLE public.contracts(id uuid primary key,contract_number text);
CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid primary key,bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
INSERT INTO portal_private.accounts VALUES('{MANAGER}','Synthetic manager','ADMIN',true,null),('{FINAL}','Synthetic final','CEO',true,null);
""", log)
                    for migration in mod.restore.MIGRATIONS:
                        mod.restore.query(source, (ROOT/'supabase/migrations'/migration).read_text(), log)
                    mod.restore.query(source, f"""
INSERT INTO portal_private.internal_entries(id,kind,amount,date,holder,reference,category,created_by,status)
VALUES(gen_random_uuid(),'EXPENSE',99,current_date,'COMPANY','pending-fixture','Fixture','{MANAGER}','PENDING'),
(gen_random_uuid(),'EXPENSE',27,current_date,'COMPANY','approved-fixture','Fixture','{MANAGER}','APPROVED');
""", log)
                    roles = mod.restore.query(source, mod.restore.ROLE_SQL, log)
                    with archive.open('wb') as stream:
                        mod.restore.run(['docker','exec',source,'pg_dump','-U','postgres','-Fc','postgres'], log, stdout=stream)
                with isolated(log) as target:
                    fingerprints = mod.rehearse(target, archive, roles, MANAGER, FINAL,
                        (ROOT/'supabase/migrations'/mod.MIGRATION).read_text(), log)
                    assert len(fingerprints) == 10
                    assert mod.restore.query(target, 'SELECT sum(amount) FROM portal_private.internal_entries', log) == '126.00'
                    assert mod.restore.query(target, mod.preflight_sql(MANAGER, FINAL), log) == 'f'
                    # Deliberately contaminate permissions: the verifier must reject it.
                    mod.restore.query(target, 'GRANT EXECUTE ON FUNCTION portal_private.operations_core_v1(text,jsonb) TO authenticated', log)
                    try:
                        mod.verify(target, MANAGER, FINAL, log)
                    except RuntimeError:
                        pass
                    else:
                        raise AssertionError('Private core execute bypass was not detected')
                print('PASS: PostgreSQL dump/restore, approval migration, existing money preserved, identities and bypass rejection')
            except Exception:
                log.seek(0)
                print(log.read().decode(errors='replace')[-4000:])  # Synthetic test fixtures only.
                raise


if __name__ == '__main__':
    if '--integration' in sys.argv:
        integration()
    else:
        unittest.main()
