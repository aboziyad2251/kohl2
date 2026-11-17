import copy,importlib.util,io,unittest
from pathlib import Path
from contextlib import redirect_stdout
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('disable',Path(__file__).resolve().parents[1]/'scripts/disable-account-recovery.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Safety(unittest.TestCase):
 def fixture(self):return {'Image':m.IMAGE,'State':{'Running':True},'Config':{'Env':['PASSWORD_RECOVERY_ENABLED=true','GOOGLE_LOGIN_ENABLED=true','OTHER=fixture']}}
 def test_only_flag_changed_and_original_preserved(self):
  old=self.fixture();saved=copy.deepcopy(old);new=m.candidate(old)
  self.assertEqual(old,saved);self.assertEqual(new['Config']['Env'],['GOOGLE_LOGIN_ENABLED=true','OTHER=fixture','PASSWORD_RECOVERY_ENABLED=false'])
 def test_unexpected_image_refused(self):
  old=self.fixture();old['Image']='wrong'
  with self.assertRaises(RuntimeError):m.candidate(old)
 def test_dry_run_cannot_mutate_docker(self):
  with patch.object(m,'inspect',return_value=self.fixture()),patch.object(m.h,'payload',return_value=({},'net',{})),patch.object(m.subprocess,'run') as run,patch.object(m.h,'api') as api,redirect_stdout(io.StringIO()):
   m.execute(False);api.assert_not_called();self.assertEqual(run.call_count,1)
   self.assertEqual(run.call_args.args[0][-1],'-t')
if __name__=='__main__':unittest.main()
