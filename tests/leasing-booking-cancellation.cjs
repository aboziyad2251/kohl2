const assert=require('assert/strict'),{fixture,migrate,actor,ids}=require('./fixtures/erp-db.cjs');
const uuid=n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0');
(async()=>{
 const db=await fixture();
 try{
  await db.exec(`
ALTER TABLE portal_private.accounts ADD COLUMN employee_id uuid;
UPDATE portal_private.accounts SET employee_id=user_id;
UPDATE portal_private.accounts SET role='ADMIN' WHERE user_id='${ids.manager}';
CREATE TABLE public.crm_leads(id uuid primary key,name text,phone text,source text,assigned_agent_id uuid);
CREATE TABLE public.contracts(id uuid primary key,contract_number text);
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
INSERT INTO public.crm_leads VALUES('${uuid(1)}','Synthetic lead','0500000000','Fixture','${ids.employee}');
`);
  await migrate(db,'20261110143135_leasing_internal_finance.sql');
  await migrate(db,'20261110215449_operations_private_documents.sql');
  await db.query("SELECT set_config('kohl.workflow_manager',$1,false),set_config('kohl.workflow_final',$2,false)",[ids.admin,ids.ceo]);
  await migrate(db,'20261112172325_operations_approval_chain.sql');
  const call=async(op,p={})=>(await db.query('SELECT public.kohl_operations($1,$2) result',[op,p])).rows[0].result;
  const denied=async(fn,code='42501')=>assert.rejects(fn,e=>e.code===code);
  await db.exec(require('fs').readFileSync('scripts/sql/leasing-booking-cancellation.sql','utf8'));
  await db.exec(`RESET ROLE; INSERT INTO public.contracts VALUES('${uuid(80)}','Contract retained');
INSERT INTO portal_private.leasing_cases(id,lead_id,assignee_id,kind,source,need,contract_id) VALUES('${uuid(81)}','${uuid(1)}','${ids.employee}','ANNUAL','Fixture','Retain all financial records','${uuid(80)}');
INSERT INTO portal_private.internal_entries(id,case_id,kind,amount,date,holder,reference,category,created_by,status) VALUES('${uuid(82)}','${uuid(81)}','EXPENSE',100,current_date,'COMPANY','Retain','Fixture','${ids.admin}','PENDING');`);
  const cancel=()=>db.query('SELECT public.cancel_leasing_booking($1) result',[uuid(81)]);
  for(const role of ['employee','manager']) {await actor(db,role);await denied(cancel);}
  await actor(db,'admin');assert.equal((await cancel()).rows[0].result.saved,true);
  await actor(db,'ceo');assert.equal((await cancel()).rows[0].result.already_cancelled,true);
  await db.exec('RESET ROLE');
  const row=(await db.query('SELECT * FROM portal_private.leasing_cases WHERE id=$1',[uuid(81)])).rows[0];
  assert.equal(row.contract_id,uuid(80));assert.equal(row.stage,'NEW');assert.equal(row.booking_cancelled_by,ids.admin);
  assert.equal((await db.query('SELECT status FROM portal_private.internal_entries WHERE id=$1',[uuid(82)])).rows[0].status,'PENDING');
  assert.equal((await db.query("SELECT count(*)::int n FROM portal_private.operations_history WHERE action='BOOKING_CANCEL'")).rows[0].n,1);
  console.log('PASS: designated cancellation without financial prerequisite; employee/unrelated admin denied; contract, pending entry and audit retained; repeated cancellation idempotent');
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exit(1)});
