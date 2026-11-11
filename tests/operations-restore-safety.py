"""Command-boundary checks; full Supabase restore acceptance is separate."""
import importlib.util
import io
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('review', Path(__file__).resolve().parents[1] / 'scripts/rehearse-operations-restore.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class Safety(unittest.TestCase):
    def test_isolation_and_cleanup_on_failure(self):
        commands=[]
        def fake(args, **kwargs):
            commands.append(args)
            return subprocess.CompletedProcess(args, 0, b'')
        with patch.object(mod.subprocess,'run',side_effect=fake):
            with self.assertRaisesRegex(RuntimeError,'fixture'):
                with mod.sandbox(mod.IMAGE,io.BytesIO()) as name:
                    self.assertTrue(name.startswith('kohl_restore_review_'))
                    raise RuntimeError('fixture')
        create=commands[0]
        self.assertEqual(create[create.index('--network')+1],'none')
        self.assertNotIn('-p',create)
        self.assertNotIn('--env-file',create)
        self.assertNotIn('--volume',create)
        self.assertNotIn('supabase-db',str(commands))
        self.assertEqual(commands[-1],['docker','rm','-f','-v',name])

    def test_source_query_is_metadata_only(self):
        self.assertIn('BEGIN READ ONLY;',mod.ROLE_SQL)
        self.assertNotIn('pg_authid',mod.ROLE_SQL)
        self.assertNotIn('rolpassword',mod.ROLE_SQL)
        self.assertIn('NOLOGIN',mod.ROLE_SQL)

if __name__=='__main__':
    unittest.main()
