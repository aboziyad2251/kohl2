import ast,copy,pathlib,tempfile,unittest
source=pathlib.Path('scripts/release-broker-ui.py').read_text()
tree=ast.parse(source)
function=next(node for node in tree.body if isinstance(node,ast.FunctionDef) and node.name=='prepare_hatif_runtime')
scope={'copy':copy,'pathlib':pathlib}
exec(compile(ast.Module(body=[function],type_ignores=[]),'hatif-helper','exec'),scope)
class HatifRuntime(unittest.TestCase):
 def test_merge_and_fail_closed(self):
  with tempfile.TemporaryDirectory() as directory:
   path=pathlib.Path(directory)/'fixture.env'
   old={'Config':{'Env':['UNCHANGED=value','HATIF_ENABLED=false','HATIF_WEBHOOK_SECRET=old']}}
   fixture='HATIF_CLIENT_ID=fixture\nHATIF_CLIENT_SECRET="fixture-only"\nHATIF_WEBHOOK_SECRET="'+('x'*25)+'"\n'
   path.write_text(fixture)
   result=scope['prepare_hatif_runtime'](old,path)
   self.assertIn('HATIF_ENABLED=true',result['Config']['Env'])
   self.assertIn('UNCHANGED=value',result['Config']['Env'])
   self.assertIn('HATIF_WEBHOOK_SECRET=old',old['Config']['Env'])
   self.assertEqual(len([s for s in result['Config']['Env'] if s.startswith('HATIF_WEBHOOK_SECRET=')]),1)
   for invalid in ['',fixture+'HATIF_CLIENT_ID=again\n',fixture.replace('x'*25,'short'),fixture.replace('x'*25,'•'*25)]:
    path.write_text(invalid)
    with self.assertRaises(RuntimeError):scope['prepare_hatif_runtime'](old,path)
   path.unlink()
   with self.assertRaises(FileNotFoundError):scope['prepare_hatif_runtime'](old,path)
 def test_preflight_precedes_mutations(self):
  release=pathlib.Path('scripts/release-payout.py').read_text()
  self.assertLess(release.index("main_candidate=runtime['prepare_hatif_runtime'](old)"),release.index('db(transaction)'))
  self.assertLess(release.index("main_candidate=runtime['prepare_hatif_runtime'](old)"),release.index("'/stop?t=20'"))
  self.assertIn("originals={'kohl_crm_app':main_candidate,'kohl_broker_frontend':broker}",release)
if __name__=='__main__':unittest.main()
