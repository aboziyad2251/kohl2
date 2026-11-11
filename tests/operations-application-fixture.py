"""Fixture-driver assertions only; real application HTTP run is performed on VPS."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import unittest
import uuid
import zipfile
from unittest.mock import patch

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixture',root/'scripts/operations-application-fixture.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)

class Driver(unittest.TestCase):
    def exercise(self, broken_denial=False):
        state={'inactive':False}
        did=str(uuid.uuid4());employee=str(uuid.uuid4())
        def sql(statement):
            if 'SET is_active=false' in statement:state['inactive']=True
        content=b'%PDF-1.7\nApplication route fixture\n%%EOF'
        def http(host,path,bearer=None,method='GET',body=None,raw=None,raw_type=None):
            status=200;data={}
            if path=='/api/operations':
                if bearer is None:status=401
                elif bearer=='employee' and state['inactive']:status=403
                elif method=='POST' and body['operation']=='ENTRY_CREATE':state['entry']=body['id']
                elif method=='POST' and body['operation']=='ENTRY_DECIDE':state['approved']=True
            elif path=='/api/operations/documents':
                self.assertTrue(raw_type.startswith('multipart/form-data; boundary='))
                self.assertIn(content,raw)
                status=409 if state.get('approved') else 200;data={'id':did}
            elif path.startswith('/api/operations/documents?'):
                if bearer=='employee':status=200 if broken_denial else 403
                else:return 200,content
            elif path.startswith('/api/operations/export/documents?'):
                if bearer=='employee':status=403
                else:
                    output=io.BytesIO()
                    with zipfile.ZipFile(output,'w') as z:
                        z.writestr('report.xlsx',b'fixture')
                        z.writestr('manifest.json',json.dumps({'documents':[{'id':did}]}))
                        z.writestr('documents/'+state['entry']+'/'+did+'.pdf',content)
                    return 200,output.getvalue()
            elif path=='/admin/users':data={'id':employee}
            elif path.startswith('/token?'):data={'access_token':'employee'}
            return status,json.dumps(data).encode()
        def require(response):
            status,body=response
            self.assertEqual(status,200)
            return json.loads(body)
        with patch('sys.stdout',new_callable=io.StringIO):
            fixture.run(http,require,sql,'admin','fixture-password','service',root,lambda stage:None)

    def test_flow(self):self.exercise()
    def test_other_employee_access_must_fail(self):
        with self.assertRaises(AssertionError):self.exercise(True)

if __name__=='__main__':unittest.main()
