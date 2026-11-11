"""Offline restore rehearsal acceptance using synthetic data and the Supabase image."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile

spec = importlib.util.spec_from_file_location('rehearsal', Path(__file__).resolve().parents[1] / 'scripts/rehearse-operations-restore.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

fixture = """
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA portal_private;
CREATE SCHEMA storage;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
CREATE EXTENSION supabase_vault;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
CREATE TABLE portal_private.accounts(user_id uuid primary key,full_name text,role text,is_active boolean,employee_id uuid);
CREATE TABLE public.properties(id uuid primary key,property_name text);
CREATE TABLE public.crm_leads(id uuid primary key,name text,phone text,source text,assigned_agent_id uuid);
CREATE TABLE public.contracts(id uuid primary key,contract_number text);
CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid primary key,bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
INSERT INTO public.properties VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic restore fixture');
"""
with tempfile.TemporaryDirectory() as temp:
    archive = Path(temp) / 'fixture.dump'
    with (Path(temp) / 'private.log').open('w+b') as log:
        try:
            with mod.sandbox(sys.argv[1], log) as source:
                mod.query(source, fixture, log)
                roles = mod.query(source, mod.ROLE_SQL, log)
                with archive.open('wb') as out:
                    mod.run(['docker','exec',source,'pg_dump','-U','postgres','-Fc','postgres'],log,stdout=out)
            with mod.sandbox(sys.argv[1], log) as target:
                mod.query(target, roles, log)
                mod.restore(target, archive, log)
                assert mod.query(target, 'SELECT count(*) FROM properties', log) == '1'
                for migration in mod.MIGRATIONS:
                    mod.query(target, (mod.ROOT/'supabase/migrations'/migration).read_text(), log)
                mod.verify(target, log)
            print('PASS: Supabase isolated bootstrap, six extensions, backup restore, both migrations and privileges')
        except Exception:
            log.seek(0)
            # This fixture-only log contains no user or production data.
            print(log.read().decode()[-5000:])
            raise
