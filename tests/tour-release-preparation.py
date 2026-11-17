import copy,importlib.util,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('tour',Path(__file__).resolve().parents[1]/'scripts/prepare-tour-release.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Safety(unittest.TestCase):
 def data(self):return {name:{'Image':image,'State':{'Running':True},'Config':{'Env':['PASSWORD_RECOVERY_ENABLED=false']}} for name,image in m.LIVE.items()}
 def test_no_mutation_and_hatif_required(self):
  original=self.data();saved=copy.deepcopy(original)
  with patch.object(m.build,'inspect',side_effect=lambda name:original[name]),patch.object(m.build,'candidate_runtime') as validate:
   self.assertEqual(m.checkpoint(),saved);validate.assert_called_once();self.assertEqual(original,saved)
 def test_enabled_recovery_blocks_preparation(self):
  original=self.data();original['kohl_account_frontend']['Config']['Env']=['PASSWORD_RECOVERY_ENABLED=true']
  with patch.object(m.build,'inspect',side_effect=lambda name:original[name]),patch.object(m.build,'candidate_runtime') as validate:
   with self.assertRaisesRegex(RuntimeError,'recovery'):m.checkpoint()
   validate.assert_not_called()
 def test_wrong_main_refused(self):
  original=self.data();original['kohl_crm_app']['Image']='unexpected'
  with patch.object(m.build,'inspect',side_effect=lambda name:original[name]):
   with self.assertRaisesRegex(RuntimeError,'checkpoint'):m.checkpoint()
if __name__=='__main__':unittest.main()
