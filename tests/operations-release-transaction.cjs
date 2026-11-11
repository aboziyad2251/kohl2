// Execute the dispatcher's actual combined SQL on synthetic PostgreSQL (PGlite).
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {PGlite}=require('@electric-sql/pglite');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sql=execFileSync('python3',['-B','-c',`
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('release',Path('scripts/release-operations.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
print(m.migration_sql([(m.ROOT/'supabase/migrations'/name).read_text() for name in m.prep.MIGRATIONS]))
`],{cwd:root,encoding:'utf8'});
async function fixture(){
 const db=new PGlite();
 await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;create schema portal_private;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
 create table portal_private.accounts(user_id uuid primary key,full_name text,role text,is_active boolean,employee_id uuid);
 create table public.properties(id uuid primary key,property_name text);
 create table public.crm_leads(id uuid primary key,name text,phone text,source text,assigned_agent_id uuid);
 create table public.contracts(id uuid primary key,contract_number text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 `);
 return db;
}
(async()=>{
 const db=await fixture();
 try {
  await db.exec(sql);
  const result=await db.query(`select to_regprocedure('public.kohl_operations(text,jsonb)') is not null as operations,
   to_regprocedure('public.operations_document(uuid,text,jsonb)') is not null as documents,
   (select not public from storage.buckets where id='kohl-finance-documents') as private_bucket,
   has_function_privilege('anon','public.kohl_operations(text,jsonb)','EXECUTE') as anonymous,
   has_function_privilege('authenticated','public.operations_document(uuid,text,jsonb)','EXECUTE') as browser_upload`);
  assert.deepEqual(result.rows[0],{operations:true,documents:true,private_bucket:true,anonymous:false,browser_upload:false});
 } finally {await db.close();}
 const failed=await fixture();
 try {
  // A preexisting policy makes the second migration fail AFTER the first created its tables.
  await failed.exec(`create policy kohl_finance_no_browser_access on storage.objects using(false)`);
  await assert.rejects(()=>failed.exec(sql),e=>e.code==='42710');
  await failed.exec('ROLLBACK');
  const result=await failed.query(`select to_regclass('portal_private.leasing_cases') is null as no_tables,
   to_regprocedure('public.kohl_operations(text,jsonb)') is null as no_rpc,
   not exists(select 1 from storage.buckets where id='kohl-finance-documents') as no_bucket`);
  assert.deepEqual(result.rows[0],{no_tables:true,no_rpc:true,no_bucket:true});
 } finally {await failed.close();}
 console.log('Release transaction passed: both migrations commit together; second-migration failure rolls back both; grants remain scoped.');
})().catch(error=>{console.error(error);process.exitCode=1;});
