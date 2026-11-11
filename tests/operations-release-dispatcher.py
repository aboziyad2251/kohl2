"""Synthetic Docker lifecycle and release failure tests; no Docker or production access."""
import argparse
import copy
from contextlib import ExitStack, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('release',Path(__file__).resolve().parents[1]/'scripts/release-operations.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
OLD={'Id':'original','Name':'/kohl_crm_app','Image':m.prep.LIVE['kohl_crm_app'],'Mounts':[],
     'State':{'Running':True},'Config':{'Env':['HATIF_ENABLED=true','OTHER=fixture'],'Image':'old-tag','Labels':{}},
     'HostConfig':{'NetworkMode':'primary','PortBindings':{'3000/tcp':[{'HostPort':'3020'}]},'RestartPolicy':{'Name':'always','MaximumRetryCount':0}},
     'NetworkSettings':{'Networks':{'primary':{'Aliases':['kohl_crm_app']},'secondary':{'Aliases':['app']}}}}


def originals():
    result={'kohl_crm_app':copy.deepcopy(OLD)}
    for name in ('kohl_broker_frontend','kohl_account_frontend'):
        result[name]=copy.deepcopy(OLD)
        result[name].update(Id=name,Name='/'+name,Image=m.prep.LIVE[name])
    return result


def candidate():
    result=copy.deepcopy(OLD);result['Config']['Image']=m.prep.CANDIDATE
    return result


class Engine:
    """Stateful fake: exercises the real rollback, including lost mutation responses."""
    def __init__(self,failure=None,after=False):
        self.containers={v['Id']:v for v in originals().values()}
        self.failure=failure;self.after=after;self.calls=[]

    def inspect(self,name,image=False):
        if image:return {'Id':m.prep.CANDIDATE}
        for item in self.containers.values():
            if name in (item['Id'],item['Name'].lstrip('/')):return copy.deepcopy(item)
        raise RuntimeError('Missing fixture container')

    def api(self,method,path,body=None):
        self.calls.append((method,path))
        fail=self.failure and self.failure in path
        if fail:
            self.failure=None
            if not self.after:raise RuntimeError('Injected Docker failure')
        result=None
        if method=='GET':
            result=[{'Id':v['Id']} for v in self.containers.values() if v['Name']=='/kohl_crm_app']
        elif path.startswith('/containers/create?'):
            new=copy.deepcopy(OLD)
            new.update(Id='candidate',Image=m.prep.CANDIDATE)
            new['Config']={k:copy.deepcopy(v) for k,v in body.items() if k not in ('HostConfig','NetworkingConfig')}
            new['HostConfig']=body['HostConfig'];new['State']['Running']=False
            self.containers['candidate']=new
            result={'Id':'candidate'}
        elif path.startswith('/networks/'):
            pass
        else:
            identifier=path.split('/')[2].split('?')[0]
            target=self.containers[identifier]
            if method=='DELETE':del self.containers[identifier]
            elif '/stop?' in path:target['State']['Running']=False
            elif '/rename?' in path:target['Name']='/'+path.split('name=')[1]
            elif path.endswith('/start'):target['State']['Running']=True
            elif path.endswith('/update'):target['HostConfig']['RestartPolicy']=body['RestartPolicy']
            else:raise AssertionError(path)
        if fail and self.after:raise RuntimeError('Injected lost Docker response')
        return result


class Release(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.plan=Path(self.temp.name)/'plan';self.plan.mkdir()
        self.folder=self.plan/'release-test';self.folder.mkdir()
        self.plan_data={'source':m.prep.SOURCE,'image':m.prep.CANDIDATE,'migration_hashes':m.EXPECTED_HASHES}
        for filename,data in [('plan.json',self.plan_data),('runtime-original.private.json',originals()),('runtime-candidate.private.json',candidate())]:
            (self.plan/filename).write_text(json.dumps(data))

    def harness(self,engine):
        stack=ExitStack();self.addCleanup(stack.close)
        stack.enter_context(patch.object(m,'api',side_effect=engine.api))
        stack.enter_context(patch.object(m.prep,'inspect',side_effect=engine.inspect))
        stack.enter_context(patch.object(m.prep,'prepare_runtime',return_value=candidate()))
        stack.enter_context(patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],0,b'',b'')))
        stack.enter_context(patch.object(m,'nginx'))
        stack.enter_context(patch.object(m,'health'))
        stack.enter_context(patch.object(m,'public_health'))
        stack.enter_context(patch.object(m.signal,'signal'))
        return stack

    def assert_restored(self,engine):
        self.assertEqual(engine.inspect('kohl_crm_app'),OLD)
        self.assertNotIn('candidate',engine.containers)
        for name in ('kohl_broker_frontend','kohl_account_frontend'):
            self.assertEqual(engine.inspect(name),originals()[name])
        self.assertEqual(json.loads((self.folder/'cutover.json').read_text())['phase'],'rolled-back')

    def test_preserves_runtime_and_rejects_unhandled_mounts_networks(self):
        old=copy.deepcopy(OLD);body,primary,endpoints=m.payload(old,m.prep.CANDIDATE,'release')
        self.assertEqual(old,OLD)
        self.assertEqual(body['Env'],OLD['Config']['Env'])
        self.assertEqual(body['HostConfig'],OLD['HostConfig'])
        self.assertEqual(primary,'primary');self.assertEqual(set(endpoints),{'primary','secondary'})
        changed=copy.deepcopy(OLD);changed['HostConfig']['AutoRemove']=True
        with self.assertRaisesRegex(RuntimeError,'Auto-remove'):m.payload(changed,m.prep.CANDIDATE,'x')
        for field in ('IPAMConfig','Links','DriverOpts'):
            changed=copy.deepcopy(OLD);changed['NetworkSettings']['Networks']['primary'][field]={'x':'y'}
            with self.assertRaisesRegex(RuntimeError,'Static network'):m.payload(changed,m.prep.CANDIDATE,'x')
        for key in ('Mounts','Volumes'):
            changed=copy.deepcopy(OLD)
            (changed if key=='Mounts' else changed['Config'])[key]=['fixture']
            with self.assertRaisesRegex(RuntimeError,'mounts'):m.payload(changed,m.prep.CANDIDATE,'x')

    def test_success_and_explicit_recovery(self):
        engine=Engine();self.harness(engine)
        m.cutover(OLD,candidate(),originals(),self.folder,None)
        self.assertEqual(engine.inspect('kohl_crm_app')['Image'],m.prep.CANDIDATE)
        self.assertFalse(engine.inspect('original')['State']['Running'])
        self.assertEqual(engine.inspect('original')['HostConfig']['RestartPolicy']['Name'],'no')
        self.assertEqual(engine.inspect('candidate')['HostConfig']['RestartPolicy']['Name'],'always')
        (self.plan/'apply-started.json').write_text(json.dumps({'directory':str(self.folder)}))
        with redirect_stdout(io.StringIO()):m.recover(self.plan,self.folder,OLD['Image'])
        self.assert_restored(engine)
        # Repeating rollback is safe and never reapplies SQL.
        with redirect_stdout(io.StringIO()):m.recover(self.plan,self.folder,OLD['Image'])
        self.assert_restored(engine)

    def test_failures_and_lost_responses_restore_original(self):
        for point in ('/update','/stop','/rename','/containers/create?','/networks/secondary/connect','/candidate/start'):
            for after in (False,True):
                with self.subTest(point=point,after=after):
                    engine=Engine(point,after)
                    with self.harness(engine):
                        with self.assertRaisesRegex(RuntimeError,'original application restored'):
                            m.cutover(OLD,candidate(),originals(),self.folder,None)
                        self.assert_restored(engine)

    def test_health_runtime_and_interruption_failures_restore_original(self):
        for point in ('health','public','runtime','interrupt','terminate'):
            with self.subTest(point=point):
                engine=Engine()
                with self.harness(engine):
                    if point=='runtime':
                        inspect=engine.inspect
                        def changed(name,image=False):
                            data=inspect(name,image)
                            if name=='candidate':data['Config']['Env']=['OTHER=changed']
                            return data
                        m.prep.inspect.side_effect=changed
                    elif point=='public':m.public_health.side_effect=[RuntimeError('public failure'),None]
                    else:m.health.side_effect={'health':RuntimeError('health'),'interrupt':KeyboardInterrupt(),'terminate':InterruptedError()}[point]
                    with self.assertRaisesRegex(RuntimeError,'original application restored'):
                        m.cutover(OLD,candidate(),originals(),self.folder,None)
                    self.assert_restored(engine)

    def test_rollback_refuses_unrelated_or_changed_containers(self):
        engine=Engine();self.harness(engine)
        foreign=copy.deepcopy(OLD);foreign['Id']='foreign'
        engine.containers['original']['Name']='/saved'
        engine.containers['foreign']=foreign
        with self.assertRaisesRegex(RuntimeError,'unrelated'):m.rollback(OLD,'ours',None)
        self.assertFalse(any(method!='GET' for method,path in engine.calls))
        engine.containers['original']['Config']['Env']=['changed']
        engine.calls=[]
        with self.assertRaisesRegex(RuntimeError,'Original rollback'):m.rollback(OLD,'ours',None)
        self.assertEqual(engine.calls,[])

    def test_rollback_failure_is_recorded(self):
        engine=Engine('/candidate/start');self.harness(engine)
        with patch.object(m,'rollback',side_effect=RuntimeError('failed')):
            with self.assertRaisesRegex(RuntimeError,'needs attention'):
                m.cutover(OLD,candidate(),originals(),self.folder,None)
        self.assertEqual(json.loads((self.folder/'cutover.json').read_text())['phase'],'rollback-needs-attention')

    def test_host_lock_excludes_different_plans_and_releases_after_error(self):
        with patch.object(m,'LOCK_PATH',self.plan/'global.lock'):
            with m.release_lock():
                with self.assertRaisesRegex(RuntimeError,'Another operations'):
                    with m.release_lock():self.fail('Concurrent lock acquired')
            with m.release_lock():pass

    def test_validation_rejects_runtime_drift_and_unreviewed_hashes(self):
        engine=Engine();self.harness(engine)
        m.validate(self.plan)
        engine.containers['original']['Config']['Env'].append('ROTATED=fixture')
        with self.assertRaisesRegex(RuntimeError,'Live runtime changed'):m.validate(self.plan)
        engine.containers['original']=copy.deepcopy(OLD)
        m.prep.prepare_runtime.return_value=OLD
        with self.assertRaisesRegex(RuntimeError,'Hatif'):m.validate(self.plan)
        self.plan_data['migration_hashes']={'changed':'hash'}
        (self.plan/'plan.json').write_text(json.dumps(self.plan_data))
        with self.assertRaisesRegex(RuntimeError,'reviewed migration hashes'):m.validate(self.plan)

    def test_backup_sql_failure_and_drift_never_stop_main(self):
        for point in ('dump','archive','sql','drift','none'):
            with self.subTest(point=point), tempfile.TemporaryDirectory() as dirname:
                plan=Path(dirname)
                args=argparse.Namespace(plan=plan,apply=True,rollback=None,approved_image=m.prep.CANDIDATE)
                events=[]
                def command(cmd,**kwargs):
                    stage='dump' if 'pg_dump' in cmd else 'archive';events.append(stage)
                    if stage==point:raise subprocess.CalledProcessError(1,cmd)
                    return subprocess.CompletedProcess(cmd,0)
                def database(sql,log):
                    events.append('sql')
                    if point=='sql':raise RuntimeError('unknown migration outcome')
                validations=0
                def validate(path):
                    nonlocal validations
                    validations+=1
                    if point=='drift' and validations==2:raise RuntimeError('runtime changed during backup')
                    return self.plan_data,originals(),candidate(),'TRANSACTION'
                with patch.object(m,'validate',side_effect=validate),patch.object(m,'absence'),patch.object(m,'nginx'),patch.object(m.subprocess,'run',side_effect=command),patch.object(m,'database',side_effect=database),patch.object(m,'cutover',side_effect=lambda *a:events.append('cutover')),redirect_stdout(io.StringIO()):
                    if point=='none':m.execute(args)
                    else:
                        with self.assertRaises((RuntimeError,subprocess.CalledProcessError)):m.execute(args)
                self.assertEqual('cutover' in events,point=='none')
                self.assertTrue((plan/'apply-started.json').exists())
                if point in ('sql','none'):
                    receipt=next(plan.glob('release-*/migration.json'))
                    self.assertEqual(json.loads(receipt.read_text())['state'],'committed' if point=='none' else 'started-outcome-unknown')
                if point=='none':self.assertEqual(events,['dump','archive','sql','cutover'])

    def test_dry_run_and_missing_approval_do_not_mutate(self):
        engine=Engine();self.harness(engine)
        args=argparse.Namespace(plan=self.plan,apply=False,rollback=None,approved_image=None)
        with patch.object(m,'absence'),redirect_stdout(io.StringIO()):m.execute(args)
        self.assertEqual(engine.calls,[])
        self.assertFalse((self.plan/'apply-started.json').exists())
        args.apply=True
        with self.assertRaisesRegex(RuntimeError,'explicitly approved'):m.execute(args)
        self.assertEqual(engine.calls,[])

    def test_attempted_plan_cannot_apply_again(self):
        engine=Engine();self.harness(engine)
        (self.plan/'apply-started.json').write_text('{}')
        args=argparse.Namespace(plan=self.plan,apply=True,rollback=None,approved_image=m.prep.CANDIDATE)
        with patch.object(m,'absence'):
            with self.assertRaisesRegex(RuntimeError,'already attempted'):m.execute(args)
        self.assertEqual(engine.calls,[])

    def test_recovery_rejects_wrong_folder_or_image_before_mutation(self):
        engine=Engine();self.harness(engine)
        with self.assertRaisesRegex(RuntimeError,'belong'):m.recover(self.plan,Path('/tmp/elsewhere'),OLD['Image'])
        (self.plan/'apply-started.json').write_text(json.dumps({'directory':str(self.folder)}))
        with self.assertRaisesRegex(RuntimeError,'approval'):m.recover(self.plan,self.folder,m.prep.CANDIDATE)
        self.assertEqual(engine.calls,[])

    def test_migrations_have_one_outer_transaction(self):
        texts=[(m.ROOT/'supabase/migrations'/n).read_text() for n in m.prep.MIGRATIONS]
        sql=m.migration_sql(texts)
        self.assertEqual(sql.splitlines().count('BEGIN;'),1)
        self.assertEqual(sql.splitlines().count('COMMIT;'),1)
        self.assertIn("SET LOCAL lock_timeout='5s'",sql)
        self.assertIn('pg_try_advisory_xact_lock',sql)
        self.assertLess(sql.index('create table portal_private.leasing_units'),sql.index('insert into storage.buckets'))
        with self.assertRaises(RuntimeError):m.migration_sql(['select 1;'])

if __name__=='__main__':unittest.main()
