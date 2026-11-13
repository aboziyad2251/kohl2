"""Stateful release failure tests. No production/Docker access; all identities synthetic."""
import argparse
import copy
from contextlib import ExitStack, redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('approval_dispatcher', ROOT/'scripts/release-approval.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
OLD = {'Id':'original','Name':'/kohl_crm_app','Image':m.prep.LIVE['kohl_crm_app'],'Mounts':[],
       'State':{'Running':True,'StartedAt':'fixture'},
       'Config':{'Env':['HATIF_ENABLED=true','OTHER=fixture'],'Image':'old','Labels':{}},
       'HostConfig':{'NetworkMode':'primary','PortBindings':{'3000/tcp':[{'HostPort':'3020'}]},'RestartPolicy':{'Name':'always','MaximumRetryCount':0}},
       'NetworkSettings':{'Networks':{'primary':{'Aliases':['kohl_crm_app']},'secondary':{'Aliases':['app']}}}}


def originals():
    result = {'kohl_crm_app':copy.deepcopy(OLD)}
    for name in ('kohl_broker_frontend','kohl_account_frontend'):
        result[name] = copy.deepcopy(OLD)
        result[name].update(Id=name, Name='/'+name, Image=m.prep.LIVE[name])
    return result


def candidate():
    value = copy.deepcopy(OLD); value['Config']['Image'] = m.CANDIDATE
    return value


class Engine:
    def __init__(self, failure=None, after=False):
        self.containers = {x['Id']:x for x in originals().values()}
        self.failure = failure; self.after = after; self.calls = []

    def inspect(self, name, image=False):
        if image:
            return {'Id':m.CANDIDATE,'Config':{'Labels':{'org.opencontainers.image.revision':m.prep.SOURCE}}}
        if name == 'supabase-db':
            return {'Image':m.prep.restore.IMAGE}
        for item in self.containers.values():
            if name in (item['Id'],item['Name'].lstrip('/')):
                return copy.deepcopy(item)
        raise RuntimeError('Missing fixture container')

    def api(self, method, path, body=None):
        self.calls.append((method,path))
        fail = self.failure and self.failure in path
        if fail:
            self.failure = None
            if not self.after:
                raise RuntimeError('Injected Docker failure')
        result = None
        if method == 'GET':
            result = [{'Id':v['Id']} for v in self.containers.values() if v['Name']=='/kohl_crm_app']
        elif path.startswith('/containers/create?'):
            new = copy.deepcopy(OLD)
            new.update(Id='candidate',Image=m.CANDIDATE)
            new['Config'] = {k:copy.deepcopy(v) for k,v in body.items() if k not in ('HostConfig','NetworkingConfig')}
            new['HostConfig'] = body['HostConfig']; new['State']['Running'] = False
            new['NetworkSettings']['Networks'] = copy.deepcopy(body['NetworkingConfig']['EndpointsConfig'])
            self.containers['candidate'] = new; result = {'Id':'candidate'}
        elif path.startswith('/networks/'):
            network = path.split('/')[2]
            self.containers[body['Container']]['NetworkSettings']['Networks'][network] = copy.deepcopy(body['EndpointConfig'])
        else:
            identifier = path.split('/')[2].split('?')[0]
            target = self.containers[identifier]
            if method == 'DELETE':
                del self.containers[identifier]
            elif '/stop?' in path:
                target['State']['Running'] = False
            elif '/rename?' in path:
                target['Name'] = '/'+path.split('name=')[1]
            elif path.endswith('/start'):
                target['State']['Running'] = True
            elif path.endswith('/update'):
                target['HostConfig']['RestartPolicy'] = body['RestartPolicy']
            else:
                raise AssertionError(path)
        if fail and self.after:
            raise RuntimeError('Injected lost response')
        return result


class Release(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.plan = Path(self.temp.name)/'plan'; self.plan.mkdir()
        self.folder = self.plan/'release-fixture'; self.folder.mkdir()
        archive = self.plan/'postgres.dump'; archive.write_bytes(b'Synthetic backup')
        self.plan_data = {'mode':'PREPARE_ONLY','application_source':m.prep.SOURCE,'image':m.CANDIDATE,
            'migration':m.prep.MIGRATION,'migration_sha256':m.prep.HASH,'previous_images':m.prep.LIVE,
            'database_image':m.prep.restore.IMAGE,'production_changed':False,'hatif_file_matches_live':True,
            'manager_id':'11111111-1111-4111-8111-111111111111','final_id':'22222222-2222-4222-8222-222222222222',
            'rehearsal_fingerprints':{str(i):'fixture' for i in range(10)},'backup':str(archive),
            'backup_sha256':m.prep.digest(archive)}
        self.write_plan()

    def write_plan(self):
        for name, value in [('plan.private.json',self.plan_data),('runtime-original.private.json',originals()),('runtime-candidate.private.json',candidate())]:
            (self.plan/name).write_text(json.dumps(value))

    def harness(self, engine):
        stack = ExitStack(); self.addCleanup(stack.close)
        stack.enter_context(patch.object(m,'api',side_effect=engine.api))
        stack.enter_context(patch.object(m.prep,'inspect',side_effect=engine.inspect))
        stack.enter_context(patch.object(m.prep,'candidate_runtime',return_value=candidate()))
        stack.enter_context(patch.object(m,'nginx'))
        stack.enter_context(patch.object(m,'health'))
        stack.enter_context(patch.object(m,'public_health'))
        stack.enter_context(patch.object(m.signal,'signal'))
        return stack

    def restored(self, engine):
        self.assertEqual(engine.inspect('kohl_crm_app'), OLD)
        self.assertNotIn('candidate', engine.containers)
        for name in ('kohl_broker_frontend','kohl_account_frontend'):
            self.assertEqual(engine.inspect(name), originals()[name])
        self.assertEqual(json.loads((self.folder/'cutover.private.json').read_text())['phase'], 'rolled-back')

    def test_success_and_explicit_repeatable_recovery(self):
        engine = Engine(); self.harness(engine)
        m.cutover(originals(), candidate(), self.folder, None)
        self.assertEqual(engine.inspect('kohl_crm_app')['Image'], m.CANDIDATE)
        self.assertEqual(engine.inspect('original')['HostConfig']['RestartPolicy']['Name'], 'no')
        self.assertFalse(engine.inspect('original')['State']['Running'])
        (self.plan/'apply-started.private.json').write_text(json.dumps({'directory':str(self.folder),'image':m.CANDIDATE}))
        for _ in range(2):
            with redirect_stdout(io.StringIO()):
                m.recover(self.plan, self.folder, OLD['Image'])
            self.restored(engine)

    def test_failed_mutations_and_lost_responses_restore_original(self):
        for point in ('/update','/stop','/rename','/containers/create?','/networks/secondary/connect','/candidate/start'):
            for after in (False,True):
                with self.subTest(point=point,after=after):
                    engine = Engine(point, after)
                    with self.harness(engine):
                        with self.assertRaisesRegex(RuntimeError, 'Original app restored'):
                            m.cutover(originals(), candidate(), self.folder, None)
                        self.restored(engine)

    def test_health_and_interruption_failures_restore_original(self):
        for failure in (RuntimeError('unhealthy'), KeyboardInterrupt(), InterruptedError()):
            with self.subTest(failure=type(failure).__name__):
                engine = Engine()
                with self.harness(engine):
                    m.health.side_effect = [failure, None]
                    with self.assertRaisesRegex(RuntimeError, 'Original app restored'):
                        m.cutover(originals(), candidate(), self.folder, None)
                    self.restored(engine)

    def test_public_health_and_candidate_environment_mismatch_restore_original(self):
        for failure in ('public', 'environment'):
            with self.subTest(failure=failure):
                engine = Engine()
                with self.harness(engine):
                    if failure == 'public':
                        m.public_health.side_effect = [RuntimeError('public unavailable'), None]
                    else:
                        def inspect(name, image=False):
                            result = engine.inspect(name, image)
                            if name == 'candidate':
                                result['Config']['Env'] = ['HATIF_ENABLED=false']
                            return result
                        m.prep.inspect.side_effect = inspect
                    with self.assertRaisesRegex(RuntimeError, 'Original app restored'):
                        m.cutover(originals(), candidate(), self.folder, None)
                    self.restored(engine)

    def test_recovery_failure_is_durable(self):
        engine = Engine('/candidate/start'); self.harness(engine)
        with patch.object(m,'rollback',side_effect=RuntimeError('cannot recover')):
            with self.assertRaisesRegex(RuntimeError, 'recovery needs attention'):
                m.cutover(originals(), candidate(), self.folder, None)
        self.assertEqual(json.loads((self.folder/'cutover.private.json').read_text())['phase'], 'recovery-needs-attention')

    def test_foreign_main_and_rotated_hatif_are_not_overwritten(self):
        engine = Engine(); self.harness(engine)
        foreign = copy.deepcopy(OLD); foreign['Id']='foreign'
        engine.containers['original']['Name']='/retained'; engine.containers['foreign']=foreign
        with self.assertRaisesRegex(RuntimeError,'unrelated'):
            m.rollback(OLD,'ours',None)
        self.assertFalse(any(method!='GET' for method,path in engine.calls))
        engine.calls.clear(); m.prep.candidate_runtime.side_effect=RuntimeError('Hatif differs')
        with self.assertRaisesRegex(RuntimeError,'Hatif'):
            m.rollback(OLD,'ours',None)
        self.assertEqual(engine.calls,[])

    def test_validation_blocks_drift_backup_change_and_wrong_plan(self):
        engine = Engine(); self.harness(engine)
        m.validate(self.plan)
        engine.containers['original']['Config']['Env'].append('CHANGED=yes')
        with self.assertRaisesRegex(RuntimeError,'runtime changed'):
            m.validate(self.plan)
        engine.containers['original']=copy.deepcopy(OLD)
        (self.plan/'postgres.dump').write_bytes(b'Changed')
        with self.assertRaisesRegex(RuntimeError,'backup'):
            m.validate(self.plan)
        self.plan_data['migration_sha256']='wrong'; self.write_plan()
        with self.assertRaisesRegex(RuntimeError,'reviewed approval release'):
            m.validate(self.plan)

    def test_final_hatif_check_precedes_any_container_mutation(self):
        engine = Engine(); self.harness(engine)
        m.prep.candidate_runtime.side_effect=RuntimeError('Hatif differs')
        with self.assertRaisesRegex(RuntimeError,'Hatif'):
            m.cutover(originals(),candidate(),self.folder,None)
        self.assertEqual(engine.calls,[])

    def test_default_dry_run_has_no_mutations_or_new_files(self):
        args=argparse.Namespace(plan=self.plan,apply=False,rollback=None,approved_image=None)
        engine = Engine(); self.harness(engine)
        before=set(self.plan.rglob('*'))
        with patch.object(m,'preflight') as pre, patch.object(m,'database') as db, patch.object(m,'fresh_backup') as backup, patch.object(m,'cutover') as cut, redirect_stdout(io.StringIO()):
            m.execute(args)
            pre.assert_called_once(); db.assert_not_called(); backup.assert_not_called(); cut.assert_not_called()
        self.assertEqual(engine.calls,[])
        self.assertEqual(set(self.plan.rglob('*')),before)

    def test_backup_unknown_sql_outcome_verification_and_drift_block_cutover(self):
        for failure in ('backup','sql','verify','drift',None):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory, ExitStack() as stack:
                path=Path(directory)
                args=argparse.Namespace(plan=path,apply=True,rollback=None,approved_image=m.CANDIDATE)
                events=[]; validations=0
                def validate(_):
                    nonlocal validations
                    validations+=1; events.append('validate')
                    if failure=='drift' and validations==2:
                        raise RuntimeError('drift')
                    return self.plan_data,originals(),candidate(),'SQL fixture'
                def step(name):
                    def perform(*args):
                        events.append(name)
                        if name==failure:
                            raise RuntimeError('Injected failure')
                    return perform
                stack.enter_context(patch.object(m,'validate',side_effect=validate))
                stack.enter_context(patch.object(m,'preflight',side_effect=step('preflight')))
                stack.enter_context(patch.object(m,'nginx'))
                stack.enter_context(patch.object(m,'fresh_backup',side_effect=step('backup')))
                stack.enter_context(patch.object(m,'database',side_effect=step('sql')))
                stack.enter_context(patch.object(m,'verify_applied',side_effect=step('verify')))
                cut=stack.enter_context(patch.object(m,'cutover',side_effect=step('cutover')))
                stack.enter_context(redirect_stdout(io.StringIO()))
                if failure:
                    with self.assertRaises(RuntimeError):m.execute(args)
                    cut.assert_not_called()
                else:
                    m.execute(args);cut.assert_called_once()
                    self.assertEqual(events,['validate','preflight','backup','validate','preflight','sql','verify','validate','cutover'])
                marker=json.loads((path/'apply-started.private.json').read_text())
                release=Path(marker['directory'])
                if failure=='sql':
                    self.assertEqual(json.loads((release/'migration.private.json').read_text())['state'],'started-outcome-unknown')
                with self.assertRaisesRegex(RuntimeError,'already attempted'):m.execute(args)

    def test_unapproved_image_is_rejected_before_validation(self):
        args=argparse.Namespace(plan=self.plan,apply=True,rollback=None,approved_image='wrong')
        with patch.object(m,'validate') as validate:
            with self.assertRaisesRegex(RuntimeError,'approved exact'):m.execute(args)
            validate.assert_not_called()

    def test_transaction_keeps_timeouts_before_account_locks(self):
        content=(ROOT/'supabase/migrations'/m.prep.MIGRATION).read_text()
        sql=m.transaction(self.plan_data,content)
        self.assertEqual(sql.count('\nCOMMIT;'),1)
        self.assertLess(sql.index('lock_timeout'),sql.index('FOR SHARE'))
        self.assertIn('SET LOCAL kohl.workflow_manager',sql)
        with self.assertRaisesRegex(RuntimeError,'Unreviewed'):m.transaction(self.plan_data,content+'-- changed')


if __name__=='__main__':unittest.main()
