"""Mock orchestration boundaries only; not live HTTP acceptance."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('services',Path(__file__).resolve().parents[1]/'scripts/test-operations-services.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class Safety(unittest.TestCase):
    def test_complete_flow_is_isolated(self):
        commands=[];uploads={};state={}
        uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        def fake(args,**kw):
            commands.append(args)
            out=b''
            if args[:3]==['docker','exec','-i'] and args[-1].startswith("let s="):
                q=json.loads(kw['input']);url=q['url'];body=json.loads(q['body']) if q['body'] and not q['binary'] else {}
                status=200;result={}
                if '/admin/users' in url:result={'id':uid}
                elif '/token?' in url:result={'access_token':'fixture-token'}
                elif url.endswith('/user'):
                    status=401 if q['headers']['Authorization']=='Bearer invalid-token' else 200;result={'id':uid}
                elif '/rpc/kohl_operations' in url:
                    if body['operation']=='ENTRY_CREATE':state['entry']=body['payload']['id']
                    else:result={'entries':[{'id':state['entry']}]}
                    if q['headers']['Authorization'].endswith(state.get('anon','unmatched')):status=403
                elif '/rpc/operations_document' in url:
                    result={'object_path':'fixture/doc.pdf'}
                    if q['headers']['Authorization']=='Bearer fixture-token':status=403
                elif '/object/' in url:
                    if q['method']=='POST':uploads[url]=base64.b64decode(q['body'])
                    elif q['headers'].get('Authorization')=='Bearer fixture-token' or '/object/public/' in url:status=403
                    else:
                        raw=uploads[url]
                        out=json.dumps({'status':200,'body':base64.b64encode(raw).decode()}).encode()
                if not out:out=json.dumps({'status':status,'body':base64.b64encode(json.dumps(result).encode()).decode()}).encode()
            if args[:2]==['docker','create']:
                envpath=Path(args[args.index('--env-file')+1])
                values=dict(line.split('=',1) for line in envpath.read_text().splitlines())
                if 'ANON_KEY' in values:state['anon']=values['ANON_KEY']
            return subprocess.CompletedProcess(args,0,out)
        with patch.object(mod.subprocess,'run',side_effect=fake),patch.object(mod.restore,'query',return_value='') as queries,patch.object(mod.time,'sleep'),patch('sys.stdout',new_callable=io.StringIO):
            mod.main()
        self.assertNotIn('CREATE FUNCTION auth.uid',queries.call_args_list[0].args[1])
        self.assertEqual(queries.call_args_list[1].args[1],mod.AUTH_HELPERS)
        creates=[c for c in commands if c[:2]==['docker','create']]
        self.assertEqual(len(creates),5)
        self.assertTrue(any(c[:4]==['docker','network','create','--internal'] for c in commands))
        for c in creates:
            self.assertTrue(c[c.index('--network')+1].startswith('kohl_http_review_'))
            self.assertNotIn('-p',c);self.assertNotIn('--volume',c);self.assertNotIn('--mount',c)
        self.assertEqual(len([c for c in commands if c[:3]==['docker','rm','-f']]),5)
        self.assertNotIn('supabase-db',str(commands))
        self.assertNotIn('/home/debian',str(commands))

if __name__=='__main__':unittest.main()
