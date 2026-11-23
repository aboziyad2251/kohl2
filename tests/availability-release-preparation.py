"""Preparation boundaries plus optional synthetic backup/restore integration."""
import copy
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

m = load('availability_preparation_test', 'scripts/prepare-availability-release.py')

class Boundaries(unittest.TestCase):
    def test_no_production_restore(self):
        for name in ('supabase-db', 'kohl_crm_app', 'kohl_restore_review_invalid'):
            with patch.object(m.restore, 'query') as query:
                with self.assertRaisesRegex(RuntimeError, 'disposable'):
                    m.rehearse(name, Path('/missing'), '', io.BytesIO())
                query.assert_not_called()

    def test_pin_before_writes(self):
        with patch.object(m.base, 'digest', return_value='wrong'), patch.object(m.restore, 'query') as query:
            with self.assertRaisesRegex(RuntimeError, 'migration'):
                m.rehearse('kohl_restore_review_123456789abc', Path('/missing'), '', io.BytesIO())
            query.assert_not_called()

    def test_checkpoint_preserves_runtime_and_checks_recovery(self):
        objects = {name: {'Image': image, 'State': {'Running': True}, 'Config': {'Env': ['PASSWORD_RECOVERY_ENABLED=false']}}
                   for name, image in m.LIVE.items()}
        objects['supabase-db'] = {'Image': m.restore.IMAGE}
        original = copy.deepcopy(objects)
        with patch.object(m.base, 'inspect', side_effect=lambda name: objects[name]), patch.object(m.base, 'candidate_runtime') as validate:
            m.checkpoint()
            validate.assert_called_once()
            self.assertEqual(objects, original)
            objects['kohl_account_frontend']['Config']['Env'] = ['PASSWORD_RECOVERY_ENABLED=true']
            with self.assertRaisesRegex(RuntimeError, 'recovery'):
                m.checkpoint()

    def test_receipt_requires_availability_and_hashes(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'receipt.json'
            receipt = {'passed': True, 'production_changed': False, 'image': 'fixture', 'availability': True,
                       'availability_migrations': m.MIGRATIONS, 'test_script_sha256': m.base.digest(ROOT / 'scripts/test-leasing-switch.py')}
            path.write_text(json.dumps(receipt))
            m.validate_receipt(path, 'fixture')
            for key, value in [('image', 'wrong'), ('availability', False), ('availability_migrations', {}), ('production_changed', True)]:
                path.write_text(json.dumps({**receipt, key: value}))
                with self.assertRaisesRegex(RuntimeError, 'receipt'):
                    m.validate_receipt(path, 'fixture')

    def test_prepare_only_private_plan_and_unchanged_live(self):
        image='sha256:'+'a'*64
        secret='synthetic-private-runtime'
        originals={name:{'Id':name,'Image':value,'State':{'Running':True,'StartedAt':'fixture'},'Config':{'Env':['PASSWORD_RECOVERY_ENABLED=false','HATIF_CLIENT_SECRET='+secret]},'HostConfig':{},'NetworkSettings':{}} for name,value in m.LIVE.items()}
        saved=copy.deepcopy(originals)
        def inspect(name,image_mode=False):
            if image_mode:return {'Id':image,'Config':{'Labels':{'org.opencontainers.image.revision':m.SOURCE}}}
            if name=='supabase-db':return {'Image':m.restore.IMAGE}
            return copy.deepcopy(originals[name])
        def runtime(old,new_image):
            result=copy.deepcopy(old);result['Config']['Image']=new_image;return result
        def query(name,statement,log):
            self.assertEqual(name,'supabase-db')
            self.assertTrue(statement.lstrip().startswith('BEGIN READ ONLY;'))
            self.assertTrue(statement.rstrip().endswith('ROLLBACK;'))
            if 'pg_database_size' in statement:return '10'
            if statement==m.restore.ROLE_SQL:return '-- synthetic roles'
            return '{"ready":true}'
        def backup(command,log,**kwargs):
            self.assertEqual(command[:3],['docker','exec','supabase-db'] if '-i' not in command else ['docker','exec','-i'])
            self.assertIn('supabase-db',command)
            if 'pg_dump' in command:kwargs['stdout'].write(b'synthetic backup')
            else:self.assertIn('pg_restore',command);self.assertIn('--list',command)
        def accept(command,**kwargs):
            self.assertIn('--availability',command);self.assertIn(image,command)
            path=Path(command[command.index('--receipt')+1])
            m.base.private_json(path,{'passed':True,'production_changed':False,'image':image,'availability':True,'availability_migrations':m.MIGRATIONS,'test_script_sha256':m.base.digest(ROOT/'scripts/test-leasing-switch.py')})
        @contextlib.contextmanager
        def sandbox(image,log):yield 'kohl_restore_review_123456789abc'
        original_read=Path.read_text
        def read_text(path,*args,**kwargs):
            if str(path)=='/proc/meminfo':return 'MemAvailable: 4194304 kB'
            return original_read(path,*args,**kwargs)
        with tempfile.TemporaryDirectory() as folder,contextlib.ExitStack() as stack:
            for obj,name,value in [(m,'BACKUPS',Path(folder)),(m.base,'inspect',inspect),(m.base,'candidate_runtime',runtime),(m.base.pre,'output',lambda *args:''),(m.restore,'query',query),(m.restore,'run',backup),(m.restore,'sandbox',sandbox),(m,'rehearse',lambda *args:{'kept':'digest'}),(m.subprocess,'run',accept),(m.subprocess,'check_output',lambda *args,**kwargs:(ROOT/'scripts/test-leasing-switch.py').read_bytes()),(m.shutil,'disk_usage',lambda *args:type('Usage',(),{'free':10*1024**3})()),(Path,'read_text',read_text)]:
                stack.enter_context(patch.object(obj,name,value))
            output=stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            m.prepare(image)
            self.assertNotIn(secret,output.getvalue())
            self.assertEqual(originals,saved)
            target=next(Path(folder).glob('kohl-availability-plan-*'))
            plan=json.loads((target/'plan.private.json').read_text())
            self.assertEqual(plan['mode'],'PREPARE_ONLY');self.assertFalse(plan['production_changed'])
            self.assertEqual(plan['migrations'],m.MIGRATIONS)
            for name in ['plan.private.json','runtime-original.private.json','runtime-candidate.private.json','postgres.dump','roles.private.sql','http-receipt.private.json']:
                self.assertEqual((target/name).stat().st_mode&0o777,0o600)

    def test_live_queries_wrapped_read_only(self):
        with patch.object(m.restore, 'query', return_value='ok') as query:
            self.assertEqual(m.read('supabase-db', 'SELECT 1;', io.BytesIO()), 'ok')
            statement = query.call_args.args[1]
            self.assertTrue(statement.startswith('BEGIN READ ONLY;'))
            self.assertTrue(statement.endswith('ROLLBACK;'))


def integration():
    # Reuse the tested synthetic leasing-state builder, never its production path.
    fixture = load('availability_old_leasing_fixture', 'tests/leasing-release-preparation.py')
    original = fixture.mod.rehearse
    def after_leasing(name, archive, roles, content, log):
        result = original(name, archive, roles, content, log)
        m.isolated(name)
        m.restore.query(name, """ALTER TABLE public.contracts ADD COLUMN property_id uuid,ADD COLUMN status text,ADD COLUMN start_date date,ADD COLUMN end_date date;
INSERT INTO public.contracts(id,contract_number,status,start_date,end_date) VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic active','active','2026-01-01','2027-01-01');
INSERT INTO portal_private.leasing_followups(id,case_id,assignee_id,title,due_at) SELECT gen_random_uuid(),id,assignee_id,'Existing follow-up',now() FROM portal_private.leasing_cases LIMIT 1;""", log)
        with tempfile.TemporaryDirectory() as tmp:
            current_archive = Path(tmp) / 'current.dump'
            current_roles = m.restore.query(name, m.restore.ROLE_SQL, log)
            with current_archive.open('wb') as stream:
                m.restore.run(['docker', 'exec', name, 'pg_dump', '-U', 'postgres', '-Fc', 'postgres'], log, stdout=stream)
            with fixture.oldfixture.isolated(log) as target:
                fingerprints = m.rehearse(target, current_archive, current_roles, log)
                assert len(fingerprints) >= 17
                assert m.read(target, 'SELECT status FROM public.contracts;', log) == 'active'
                assert m.read(target, 'SELECT category FROM portal_private.leasing_followups;', log) == 'GENERAL'
                m.restore.query(target, 'GRANT SELECT ON portal_private.leasing_holds TO authenticated;', log)
                assert m.read(target, m.VERIFY, log) == 'f', 'Broad privilege not detected'
            with fixture.oldfixture.isolated(log) as target:
                m.restore.query(target, current_roles, log)
                m.restore.restore(target, current_archive, log)
                tables, before = m.snapshot(target, log)
                try:
                    m.restore.query(target, m.migration_sql().replace('\nCOMMIT;', '\nSELECT 1/0;\nCOMMIT;'), log)
                except subprocess.CalledProcessError:
                    pass
                else:
                    raise AssertionError('Late migration error did not fail')
                m.preflight(target, log)
                assert m.snapshot(target, log, tables)[1] == before
        print('PASS: availability backup restore, both migrations, scoped privileges, existing data retained and late-error atomic rollback')
        return result
    with patch.object(fixture.mod, 'rehearse', side_effect=after_leasing):
        fixture.integration()

if __name__ == '__main__':
    if '--integration' in sys.argv:
        integration()
    else:
        unittest.main()
