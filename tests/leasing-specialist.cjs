const assert=require('assert/strict'),{fixture,migrate,actor,ids}=require('./fixtures/erp-db.cjs');
const uuid=n=>'bbbbbbbb-bbbb-4bbb-8bbb-'+String(n).padStart(12,'0');
(async()=>{const db=await fixture();try{
 await db.exec(`CREATE ROLE authenticator; ALTER TABLE auth.users ADD COLUMN role text default 'authenticated';
 CREATE TABLE auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
 ALTER TABLE portal_private.accounts ADD COLUMN employee_id uuid,ADD COLUMN mobile text default '0500000000',ADD COLUMN created_by uuid,ADD COLUMN invitation_status text;
 ALTER TABLE portal_private.accounts ADD CONSTRAINT accounts_role_check CHECK(role in ('ADMIN','CEO','HR','EMPLOYEE','BROKER','OWNER','TENANT'));
 CREATE TABLE public.crm_leads(id uuid primary key,name text,phone text,source text,assigned_agent_id uuid,lead_code text unique,lead_type text);
 CREATE TABLE public.contracts(id uuid primary key,contract_number text);
 CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 INSERT INTO public.crm_leads(id,name,phone,source) VALUES('${uuid(1)}','Previous customer','0500000001','Fixture');`);
 for(const m of ['20261110143135_leasing_internal_finance.sql','20261110215449_operations_private_documents.sql'])await migrate(db,m);
 await db.query("select set_config('kohl.workflow_manager',$1,false),set_config('kohl.workflow_final',$2,false)",[ids.admin,ids.ceo]);
 await migrate(db,'20261112172325_operations_approval_chain.sql');
 await db.exec(`INSERT INTO portal_private.leasing_cases(id,lead_id,assignee_id,kind,source,need) VALUES('${uuid(2)}','${uuid(1)}','${ids.admin}','DAILY','Fixture','Old request');`);
 await migrate(db,'20261113202336_leasing_specialist_account.sql');
 const denied=async(fn,code='42501')=>assert.rejects(fn,e=>e.code===code);
 const control=async(who,op,p={})=>(await db.query('SELECT public.leasing_switch_admin($1,$2,$3) result',[who,op,p])).rows[0].result;
 const call=async(op,p={})=>(await db.query('SELECT public.leasing_operations($1,$2) result',[op,p])).rows[0].result;
 await actor(db,'admin','service_role');
 await denied(()=>control(ids.ceo,'STATE'));await denied(()=>control(ids.employee,'STATE'));
 assert.equal((await control(ids.admin,'STATE')).specialist_id,null);
 await db.exec('RESET ROLE');
 await db.query('INSERT INTO auth.users(id,email,role) VALUES($1,$2,$3)',[uuid(3),'specialist@fixture.invalid','kohl_leasing']);
 await db.query('INSERT INTO auth.sessions VALUES($1,$2),($3,$4)',[uuid(4),ids.admin,uuid(5),uuid(3)]);
 await actor(db,'admin','service_role');await control(ids.admin,'REGISTER',{id:uuid(3)});
 await control(ids.admin,'BEGIN',{child_session:uuid(5),parent_session:uuid(4)});
 async function child(session=uuid(5)){await db.exec('RESET ROLE');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uuid(3),JSON.stringify({sub:uuid(3),role:'kohl_leasing',session_id:session})]);await db.exec('SET ROLE kohl_leasing');}
 await child();
 assert.equal((await db.query('select public.leasing_profile() p')).rows[0].p.account.role,'LEASING');
 const initial=await call('LIST');assert.equal(initial.cases.length,0);assert.equal(initial.leads.length,0);
 await denied(()=>db.query('select * from public.crm_leads'));await denied(()=>db.query('select * from portal_private.accounts'));
 await denied(()=>db.query("select public.kohl_operations('LIST','{}')"));
 await denied(()=>control(ids.admin,'STATE'));await denied(()=>db.query("select portal_private.leasing_core_v1('LIST','{}')"));
 for(const op of ['ENTRY_CREATE','ENTRY_DECIDE','UNIT_SAVE','EXPORT','INSTALLMENTS_SAVE'])await denied(()=>call(op,{id:uuid(9)}));
 await denied(()=>call('CASE_CREATE',{id:uuid(9),lead_id:uuid(1),kind:'DAILY',source:'Fixture',need:'Need',next_action:'Call',due_at:'2026-11-20T10:00:00Z'}));
 const contact={id:uuid(6),name:'New leasing customer',phone:'0500000002',source:'هاتف'};
 await call('CONTACT_CREATE',contact);await call('CONTACT_CREATE',contact);
 const newcase={id:uuid(7),lead_id:uuid(6),kind:'DAILY',source:'هاتف',need:'Stay',next_action:'Call',due_at:'2026-11-20T10:00:00Z'};
 await denied(()=>call('CASE_CREATE',{...newcase,assignee_id:ids.admin}));
 await call('CASE_CREATE',newcase);
 await denied(()=>call('CASE_UPDATE',{id:uuid(7),version:1,stage:'QUALIFIED',note:'Link external contract',contract_id:uuid(80)}));
 const w=await call('LIST');assert.equal(w.cases.length,1);assert.equal(w.leads.length,1);assert.equal(w.entries.length,0);assert.equal(w.dues.length,0);assert.equal(w.staff.length,1);assert.equal(w.staff[0].id,uuid(3));
 await call('FOLLOWUP_DONE',{id:w.followups[0].id,note:'Called customer',blocked_by:'NONE'});
 await denied(()=>call('CASE_UPDATE',{id:uuid(7),version:1,stage:'CONFIRMED',note:'Approve'}));
 // Availability APIs remain bound to the delegated session and new specialist's own cases.
 await db.exec('RESET ROLE');
 await db.exec(`ALTER TABLE public.contracts ADD COLUMN property_id uuid,ADD COLUMN status text,ADD COLUMN start_date date,ADD COLUMN end_date date;
 INSERT INTO public.lessors(id,name) VALUES('${uuid(40)}','Synthetic lessor');
 INSERT INTO public.properties(id,property_name,property_type,address,city,lessor_id) VALUES('${uuid(41)}','Synthetic property','Residential','Fixture','Riyadh','${uuid(40)}');
 INSERT INTO portal_private.leasing_units VALUES('${uuid(42)}','${uuid(41)}','A','READY','Fixture');`);
 const migrationText=require('fs').readFileSync('supabase/migrations/20261122073344_leasing_availability_and_reservations.sql','utf8');
 for(const name of ['leasing-booking-cancellation.sql','leasing-unit-availability.sql','leasing-temporary-holds.sql','leasing-occupancy-guards.sql','leasing-reservation-access.sql']){
  const source=require('fs').readFileSync('scripts/sql/'+name,'utf8');
  assert(migrationText.includes(source.slice(source.indexOf('begin;')+6,source.lastIndexOf('commit;')).trim()),'Candidate/migration drift: '+name);
 }
 const originalCore=(await db.query("SELECT pg_get_functiondef('portal_private.operations_core_v1(text,jsonb)'::regprocedure) definition")).rows[0].definition;
 await db.exec(originalCore.replace("other.stage='CONFIRMED' and other.start_date","other.stage='CONFIRMED' /* unexpected core revision */ and other.start_date"));
 await assert.rejects(()=>db.exec(migrationText),e=>e.message.includes('Unexpected legacy confirmation implementation'));
 await db.exec('ROLLBACK');
 assert.equal((await db.query("SELECT to_regclass('portal_private.leasing_holds')::text name")).rows[0].name,null,'Failed migration must roll back new tables');
 await db.exec(originalCore);
 await migrate(db,'20261122073344_leasing_availability_and_reservations.sql');
 await migrate(db,'20261122073458_leasing_followup_categories.sql');
 const available=()=>db.query("SELECT public.leasing_unit_availability(current_date+10,current_date+11)");
 const reserve=(cid=uuid(7))=>db.query('SELECT public.reserve_leasing_unit($1,$2,current_date+10,current_date+11)',[cid,uuid(42)]);
 const holdState=async()=>(await db.query('SELECT public.leasing_reservation_status() result')).rows[0].result;
 await child();await available();await denied(()=>reserve(uuid(2)));await reserve();
 const followup={id:uuid(60),case_id:uuid(7),title:'Arrange viewing',due_at:'2027-01-01T10:00:00Z',category:'VIEWING'};
 await call('FOLLOWUP_ADD',followup);
 assert.equal((await call('LIST')).followups.find(f=>f.id===uuid(60)).category,'VIEWING');
 await denied(()=>call('FOLLOWUP_ADD',{...followup,id:uuid(61),category:'UNKNOWN'}),'23514');
 await denied(()=>call('FOLLOWUP_ADD',{...followup,id:uuid(62),case_id:uuid(2)}));

 assert.equal((await holdState()).reservations.length,1);
 await denied(()=>db.query('SELECT public.cancel_leasing_booking($1)',[uuid(7)]));
 await denied(()=>db.query("SELECT public.extend_leasing_hold($1,'Extend')",[uuid(7)]));
 await denied(()=>db.query('SELECT public.save_leasing_unit_specs($1,3,2)',[uuid(42)]));
 await denied(()=>db.query('SELECT * FROM portal_private.leasing_holds'));
 await child(uuid(90));await denied(available);await denied(reserve);await denied(holdState);
 await db.exec('RESET ROLE');
 const holdHistory=(await db.query("SELECT actor,changes FROM portal_private.operations_history WHERE action='HOLD_CREATE' AND entity_id=$1",[uuid(7)])).rows[0];
 assert.equal(holdHistory.actor,uuid(3));assert.equal(holdHistory.changes.operator_id,ids.admin);
 await child(uuid(90));await denied(()=>call('LIST'));
 for(const [change,undo] of [
  ['UPDATE portal_private.accounts SET is_active=false WHERE user_id=\''+uuid(3)+'\'','UPDATE portal_private.accounts SET is_active=true WHERE user_id=\''+uuid(3)+'\''],
  ['UPDATE portal_private.accounts SET is_active=false WHERE user_id=\''+ids.admin+'\'','UPDATE portal_private.accounts SET is_active=true WHERE user_id=\''+ids.admin+'\''],
  ['UPDATE portal_private.leasing_delegations SET expires_at=now()-interval \'1 minute\'','UPDATE portal_private.leasing_delegations SET expires_at=now()+interval \'1 hour\''],
  ['UPDATE portal_private.leasing_specialist_config SET enabled=false','UPDATE portal_private.leasing_specialist_config SET enabled=true']
 ]) {await db.exec('RESET ROLE');await db.exec(change);await child();await denied(()=>call('LIST'));await denied(available);await denied(reserve);await denied(holdState);await db.exec('RESET ROLE');await db.exec(undo);}

 await child();await db.exec('RESET ROLE');
 assert.equal((await db.query('SELECT assignee_id FROM portal_private.leasing_cases WHERE id=$1',[uuid(2)])).rows[0].assignee_id,ids.admin);
 const history=(await db.query("SELECT actor,changes FROM portal_private.operations_history WHERE action='CASE_CREATE' AND entity_id=$1",[uuid(7)])).rows[0];
 assert.equal(history.actor,uuid(3));assert.equal(history.changes.operator_id,ids.admin);
 await db.query('DELETE FROM auth.sessions WHERE id=$1',[uuid(4)]);await child();await denied(()=>call('LIST'));
 await db.exec('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM portal_private.leasing_delegations')).rows[0].n,0);
 console.log('Leasing specialist passed: new-only scope, owner-bound sessions, restricted RPC/table permissions, dual attribution, parent logout revocation');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exit(1)});
