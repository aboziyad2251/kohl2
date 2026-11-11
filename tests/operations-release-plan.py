import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest
spec=importlib.util.spec_from_file_location('plan',Path(__file__).resolve().parents[1]/'scripts/prepare-operations-release.py')
plan=importlib.util.module_from_spec(spec);spec.loader.exec_module(plan)

class RuntimePlan(unittest.TestCase):
    def test_preserves_live_runtime_and_rollback_input(self):
        with tempfile.TemporaryDirectory() as folder:
            env=Path(folder)/'fixture.env'
            values=['HATIF_CLIENT_ID=fixture','HATIF_CLIENT_SECRET=fixture-only',
                    'HATIF_WEBHOOK_SECRET='+'x'*25,'HATIF_ENABLED=true']
            env.write_text('\n'.join(values))
            old={'Image':'old-id','Config':{'Image':'old-tag','Env':['OTHER=unchanged']+values},
                 'HostConfig':{'NetworkMode':'fixture','PortBindings':{'3000/tcp':[{'HostPort':'3020'}]}}}
            snapshot=copy.deepcopy(old)
            prepared=plan.prepare_runtime(old,env)
            self.assertEqual(old,snapshot)
            self.assertEqual(prepared['Config']['Image'],plan.CANDIDATE)
            self.assertEqual(prepared['HostConfig'],old['HostConfig'])
            self.assertEqual(set(prepared['Config']['Env']),set(old['Config']['Env']))
            env.write_text('\n'.join(values).replace('x'*25,'y'*25))
            with self.assertRaisesRegex(RuntimeError,'mismatch'):
                plan.prepare_runtime(old,env)

if __name__=='__main__':unittest.main()
