"""Verify that initialization readiness cannot accidentally admit test SQL."""
import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('runtime',Path(__file__).resolve().parents[1]/'scripts/postgres_test_runtime.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class Readiness(unittest.TestCase):
    def test_waits_for_tcp_query_not_temporary_socket(self):
        attempts=[]
        def execute(args, **kwargs):
            attempts.append(args)
            self.assertIn('-h',args)
            self.assertEqual(args[args.index('-h')+1],'127.0.0.1')
            self.assertEqual(args[-1],'SELECT 1')
            # Init-only server cannot accept TCP; final server can.
            return subprocess.CompletedProcess(args,2 if len(attempts)==1 else 0,
                                               '' if len(attempts)==1 else '1\n','')
        with patch.object(mod.subprocess,'run',side_effect=execute),patch.object(mod.time,'sleep'):
            mod.wait_for_postgres('disposable')
        self.assertEqual(len(attempts),2)

    def test_timeout_stops_before_test_sql(self):
        clock=iter([0,0,.1,1.1,1.1])
        calls=[]
        def execute(args,**kwargs):
            calls.append(args)
            if args[1]=='inspect':return subprocess.CompletedProcess(args,0,'status=exited exit=1 oom=false','')
            raise subprocess.TimeoutExpired(args,1)
        with patch.object(mod.time,'monotonic',side_effect=lambda:next(clock)),patch.object(mod.subprocess,'run',side_effect=execute):
            with self.assertRaisesRegex(RuntimeError,'TCP readiness timed out: status=exited'):
                mod.wait_for_postgres('disposable',timeout=1)
        self.assertEqual(len(calls),2)

if __name__=='__main__':unittest.main()
