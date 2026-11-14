"""Read-only preparation boundaries and a synthetic PostgreSQL backup rehearsal."""
import argparse
import ast
import copy
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from contextlib import ExitStack,redirect_stdout

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,ROOT/path);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
mod=load('leasing_preparation','scripts/prepare-leasing-specialist-release.py')
oldfixture=load('synthetic_restore_fixture','tests/approval-release-preparation.py')
MANAGER=oldfixture.MANAGER;FINAL=oldfixture.FINAL

class Boundaries(unittest.TestCase):
 def test_restore_rejects_production_before_commands(self):
  for name in ['supabase-db','kohl_crm_app','kohl_restore_review_invalid']:
   with patch.object(mod.restore,'query') as query:
    with self.assertRaisesRegex(RuntimeError,'disposable'):mod.rehearse(name,Path('/missing'),'', '',io.BytesIO())
    query.assert_not_called()
 def test_migration_hash_checked_before_restore(self):
  with patch.object(mod.restore,'query') as query:
   with self.assertRaisesRegex(RuntimeError,'Migration differs'):mod.rehearse('kohl_restore_review_123456789abc',Path('/missing'),'','unreviewed',io.BytesIO())
   query.assert_not_called()
 def test_new_harness_has_no_production_name_or_runtime_reads(self):
  source=(ROOT/'scripts/test-leasing-switch.py').read_text()
  for unsafe in ['supabase-db','kohl_crm_app','/home/debian/.config','/home/debian/backups','--privileged','--network=host']:
   self.assertNotIn(unsafe,source)
  ast.parse(source)
 def test_prepare_preserves_original_runtime_private_artifacts_and_reads_only(self):
  candidate='sha256:'+'a'*64
  values=['HATIF_ENABLED=true','HATIF_CLIENT_ID=fixture','HATIF_CLIENT_SECRET=fixture-private','HATIF_WEBHOOK_SECRET='+'z'*25]
  originals={name:{'Id':name,'Image':image,'State':{'Running':True,'StartedAt':'fixture'},'Config':{'Env':values,'Image':'old'},'HostConfig':{},'NetworkSettings':{},'Mounts':[]} for name,image in mod.LIVE.items()}
  saved=copy.deepcopy(originals)
  def inspect(name,image=False):
   if image:return {'Id':candidate,'Config':{'Labels':{'org.opencontainers.image.revision':mod.SOURCE}}}
   if name=='supabase-db':return {'Image':mod.restore.IMAGE}
   return copy.deepcopy(originals[name])
  def query(name,text,log):
   self.assertEqual(name,'supabase-db');self.assertTrue(text.lstrip().startswith('BEGIN READ ONLY;'));self.assertTrue(text.rstrip().endswith('ROLLBACK;'))
   return '10' if 'pg_database_size' in text else ('roles' if text==mod.restore.ROLE_SQL else '{"ready":true}')
  def run(command,log,**kw):
   self.assertIn('supabase-db',command)
   if 'pg_dump' in command:kw['stdout'].write(b'Private synthetic backup')
   else:self.assertIn('pg_restore',command);self.assertIn('--list',command)
  def http(command,**kw):
   self.assertIn('--app-image',command);self.assertIn(candidate,command)
   mod.private_json(Path(command[command.index('--receipt')+1]),{'image':candidate,'passed':True,'migration_sha256':mod.HASH,'production_changed':False,'test_script_sha256':mod.digest(ROOT/'scripts/test-leasing-switch.py')})
  import contextlib
  @contextlib.contextmanager
  def sandbox(image,log):yield 'kohl_restore_review_123456789abc'
  with tempfile.TemporaryDirectory() as folder,ExitStack() as stack:
   base=Path(folder)/'backups';env=Path(folder)/'hatif.env';env.write_text('\n'.join(values))
   for target,name,value in [(mod,'BACKUPS',base),(mod,'HATIF',env),(mod,'inspect',inspect),(mod.pre,'output',lambda *a,**k:''),(mod.restore,'query',query),(mod.restore,'run',run),(mod.restore,'sandbox',sandbox),(mod,'rehearse',lambda *args:{'kept':'hash'}),(mod.subprocess,'run',http)]:
    stack.enter_context(patch.object(target,name,value))
   capture=stack.enter_context(redirect_stdout(io.StringIO()))
   mod.prepare(argparse.Namespace(app_image=candidate))
   target=next(base.glob('kohl-leasing-plan-*'));plan=json.loads((target/'plan.private.json').read_text())
   self.assertFalse(plan['production_changed']);self.assertEqual(plan['image'],candidate);self.assertEqual(plan['application_source'],mod.SOURCE)
   self.assertEqual(json.loads((target/'runtime-original.private.json').read_text()),saved)
   self.assertEqual(originals,saved)
   for name in ['plan.private.json','runtime-original.private.json','runtime-candidate.private.json','postgres.dump']:
    self.assertEqual((target/name).stat().st_mode&0o777,0o600)
   self.assertNotIn('fixture-private',capture.getvalue())


def integration():
 with tempfile.TemporaryDirectory() as folder:
  archive=Path(folder)/'fixture.dump'
  with (Path(folder)/'private.log').open('w+b') as log:
   try:
    with oldfixture.isolated(log) as source:
     mod.restore.query(source,f"""
CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE authenticator NOLOGIN;
GRANT anon,authenticated,service_role TO authenticator;
CREATE SCHEMA auth;CREATE SCHEMA portal_private;CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid primary key,email text,role text);
CREATE TABLE auth.sessions(id uuid primary key,user_id uuid references auth.users);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
CREATE TABLE portal_private.accounts(user_id uuid primary key references auth.users,full_name text,mobile text,role text constraint accounts_role_check check(role in ('ADMIN','CEO','HR','EMPLOYEE','BROKER','OWNER','TENANT')),is_active boolean,employee_id uuid,created_by uuid,invitation_status text);
CREATE TABLE public.properties(id uuid primary key,property_name text);
CREATE TABLE public.crm_leads(id uuid primary key,lead_code text,name text,phone text,source text,assigned_agent_id uuid,lead_type text);
CREATE TABLE public.contracts(id uuid primary key,contract_number text);
CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid primary key,bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
INSERT INTO auth.users VALUES('{MANAGER}','manager@fixture.invalid','authenticated'),('{FINAL}','final@fixture.invalid','authenticated');
INSERT INTO portal_private.accounts(user_id,full_name,mobile,role,is_active) VALUES('{MANAGER}','Synthetic manager','0500000000','ADMIN',true),('{FINAL}','Synthetic final','0500000001','CEO',true);
""",log)
     for name in mod.restore.MIGRATIONS:mod.restore.query(source,(ROOT/'supabase/migrations'/name).read_text(),log)
     mod.restore.query(source,f"SELECT set_config('kohl.workflow_manager','{MANAGER}',false),set_config('kohl.workflow_final','{FINAL}',false);"+(ROOT/'supabase/migrations/20261112172325_operations_approval_chain.sql').read_text(),log)
     mod.restore.query(source,f"""
INSERT INTO public.crm_leads(id,name,phone,source) VALUES('33333333-3333-4333-8333-333333333333','Existing customer','0500000002','Fixture');
INSERT INTO portal_private.leasing_cases(id,lead_id,assignee_id,kind,source,need) VALUES('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','{MANAGER}','DAILY','Fixture','Keep original assignment');
INSERT INTO portal_private.operations_history(entity_id,case_id,actor,action,note) VALUES('44444444-4444-4444-8444-444444444444','44444444-4444-4444-8444-444444444444','{MANAGER}','CASE_CREATE','Keep original operator');
INSERT INTO portal_private.internal_entries(id,kind,amount,date,holder,reference,category,created_by,status,manager_reviewed_by,manager_reviewed_at)
 VALUES(gen_random_uuid(),'EXPENSE',99,current_date,'COMPANY','reviewed-fixture','Fixture','{MANAGER}','PENDING','{MANAGER}',now());
""",log)
     roles=mod.restore.query(source,mod.restore.ROLE_SQL,log)
     with archive.open('wb') as stream:mod.restore.run(['docker','exec',source,'pg_dump','-U','postgres','-Fc','postgres'],log,stdout=stream)
    content=(ROOT/'supabase/migrations'/mod.MIGRATION).read_text()
    with oldfixture.isolated(log) as target:
     before=mod.rehearse(target,archive,roles,content,log)
     assert len(before)==17
     assert mod.restore.query(target,'SELECT assignee_id FROM portal_private.leasing_cases',log)==MANAGER
     assert mod.restore.query(target,'SELECT actor FROM portal_private.operations_history',log)==MANAGER
     mod.restore.query(target,'GRANT SELECT ON public.crm_leads TO kohl_leasing',log)
     try:mod.verify(target,log)
     except RuntimeError:pass
     else:raise AssertionError('Broad table access was not detected')
    with oldfixture.isolated(log) as target:
     mod.restore.query(target,roles,log);mod.restore.restore(target,archive,log)
     before=mod.snapshot(target,log)
     try:mod.restore.query(target,content.replace('\ncommit;','\nSELECT 1/0;\ncommit;'),log)
     except subprocess.CalledProcessError:pass
     else:raise AssertionError('Injected failure should roll back')
     mod.preflight(target,log);assert mod.snapshot(target,log)==before
    if '--dispatcher' in sys.argv:
     dispatcher=load('leasing_dispatcher_native','scripts/release-leasing-specialist.py')
     with oldfixture.isolated(log) as target:
      mod.restore.query(target,roles,log);mod.restore.restore(target,archive,log)
      before=mod.snapshot(target,log);plan={'rehearsal_fingerprints':before}
      def database(sql,private_log):return mod.restore.query(target,sql,private_log)
      with patch.object(dispatcher,'database',side_effect=database):
       dispatcher.preflight(plan,log)
       sql=dispatcher.transaction(plan,content)
       # Verify the actual dispatcher guard rejects configuration drift atomically.
       drift={'rehearsal_fingerprints':{**before,dispatcher.CONFIG_KEY:'0'*32}}
       try:database(dispatcher.transaction(drift,content),log)
       except subprocess.CalledProcessError:pass
       else:raise AssertionError('Changed reviewers were not blocked')
       assert mod.snapshot(target,log)==before;dispatcher.preflight(plan,log)
       try:database(sql.replace('\nCOMMIT;','\nSELECT 1/0;\nCOMMIT;'),log)
       except subprocess.CalledProcessError:pass
       else:raise AssertionError('Dispatcher late failure did not roll back')
       assert mod.snapshot(target,log)==before;dispatcher.preflight(plan,log)
       database(sql,log);dispatcher.verify_applied(plan,log)
       assert mod.snapshot(target,log)==before
       child='55555555-5555-4555-8555-555555555555'
       parent_session='66666666-6666-4666-8666-666666666666'
       child_session='77777777-7777-4777-8777-777777777777'
       database(f"""
INSERT INTO auth.users VALUES('{child}','specialist@fixture.invalid','kohl_leasing');
SELECT public.leasing_switch_admin('{MANAGER}','REGISTER','{{"id":"{child}"}}');
INSERT INTO auth.sessions VALUES('{parent_session}','{MANAGER}'),('{child_session}','{child}');
SELECT public.leasing_switch_admin('{MANAGER}','BEGIN','{{"parent_session":"{parent_session}","child_session":"{child_session}"}}');
INSERT INTO public.crm_leads(id,name,phone,source) VALUES('88888888-8888-4888-8888-888888888888','New specialist customer','0500000003','Fixture');
INSERT INTO portal_private.leasing_specialist_leads VALUES('88888888-8888-4888-8888-888888888888','{child}');
INSERT INTO portal_private.leasing_cases(id,lead_id,assignee_id,kind,source,need) VALUES('99999999-9999-4999-8999-999999999999','88888888-8888-4888-8888-888888888888','{child}','DAILY','Fixture','Retain after recovery');
""",log)
       scope=f"""BEGIN; SET LOCAL ROLE kohl_leasing;
SELECT set_config('request.jwt.claim.sub','{child}',true);
SELECT set_config('request.jwt.claims','{{"session_id":"{child_session}"}}',true);
SELECT public.leasing_profile()->'account'->>'role'; ROLLBACK;"""
       assert database(scope,log).splitlines()[-1]=='LEASING'
       current=mod.snapshot(target,log)
       rows_sql="SELECT jsonb_build_object('delegations',(SELECT jsonb_agg(to_jsonb(t)) FROM portal_private.leasing_delegations t),'leads',(SELECT jsonb_agg(to_jsonb(t)) FROM portal_private.leasing_specialist_leads t));"
       private_rows=database(rows_sql,log)
       dispatcher.suspend_specialist(log);dispatcher.suspend_specialist(log)
       assert mod.snapshot(target,log)==current
       assert database(rows_sql,log)==private_rows
       try:database(scope,log)
       except subprocess.CalledProcessError:pass
       else:raise AssertionError('Delegated session remained usable after recovery')
       assert database("SELECT assignee_id FROM portal_private.leasing_cases WHERE id='44444444-4444-4444-8444-444444444444'",log)==MANAGER
     print('PASS: actual dispatcher transaction, reviewer drift rejection, late rollback, recovery denies existing session while retaining new and old data')
    print('PASS: leasing backup/restore, new-role permissions, original assignments/reviews/history preserved, late-error transaction rollback')
   except Exception:
    log.seek(0);print(log.read().decode(errors='replace')[-3000:]);raise # Synthetic fixture only.
if __name__=='__main__':
 if '--integration' in sys.argv:integration()
 else:unittest.main()
