// PROPOSED migration acceptance. Run only after user approval, in disposable PGlite.
const assert=require('assert/strict'),{fixture,migrate,ids}=require('./fixtures/erp-db.cjs');
const broker='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const contract='cccccccc-cccc-4ccc-8ccc-cccccccccccc',agreement='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const first='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002',third='10000000-0000-4000-8000-000000000003';
(async()=>{const db=await fixture();try{
 await db.exec(`create table public.contracts(id uuid primary key,contract_number text,rent_amount numeric,start_date date,end_date date,office_profit numeric);
 create table portal_private.broker_office_agreements(id uuid primary key,broker_user_id uuid,commission_type text,commission_value numeric,percentage_basis text);
 create table portal_private.broker_contract_links(broker_user_id uuid,contract_id uuid,agreement_id uuid,commission_type text,commission_value numeric,percentage_basis text,payout_status text default 'pending',closed_at timestamptz,primary key(broker_user_id,contract_id));
 create function portal_private.contract_value(numeric,date,date) returns numeric language sql immutable as $$select $1$$;`);
 for(const id of [broker,other]){await db.query('insert into auth.users values($1,$2)',[id,'broker@fixture.invalid']);await db.query("insert into portal_private.accounts values($1,'Fixture broker','BROKER',true)",[id]);}
 await db.query("insert into public.contracts values($1,'FIXTURE-LEASE',5000,'2026-01-01','2026-12-31',1000)",[contract]);
 await db.query("insert into portal_private.broker_office_agreements values($1,$2,'PERCENTAGE',10,'DEAL_VALUE')",[agreement,broker]);
 await db.query("insert into portal_private.broker_contract_links(broker_user_id,contract_id,agreement_id,closed_at) values($1,$2,$3,now())",[broker,contract,agreement]);
 await migrate(db,'20261109003906_broker_payout_requests.sql');
 const actor=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+role);};
 const call=async(operation,payload={})=>(await db.query('select public.broker_payout_requests($1,$2) as data',[operation,JSON.stringify(payload)])).rows[0].data;
 const denied=async(fn)=>{let error;try{await fn();}catch(e){error=e;}assert(error,'Expected database denial');};
 await actor(broker);let page=await call('LIST');assert.deepEqual(page.eligible_contract_ids,[contract]);
 for(const restriction of ["closed_at=null","closed_at=now()+interval '1 day'","payout_status='paid'","commission_type='FIXED',commission_value=0,percentage_basis=null"]){
  await db.exec('reset role');await db.query("update portal_private.broker_contract_links set commission_type=null,commission_value=null,percentage_basis=null,payout_status='pending',closed_at=now()-interval '1 day' where contract_id=$1",[contract]);
  await db.query('update portal_private.broker_contract_links set '+restriction+' where contract_id=$1',[contract]);await actor(broker);
  assert.deepEqual((await call('LIST')).eligible_contract_ids,[]);await denied(()=>call('SUBMIT',{request_id:first,contract_id:contract}));
 }
 await db.exec('reset role');await db.query("update portal_private.broker_contract_links set commission_type=null,commission_value=null,percentage_basis=null,payout_status='pending',closed_at=now()-interval '1 day' where contract_id=$1",[contract]);await actor(broker);

 let row=await call('SUBMIT',{request_id:first,contract_id:contract,note:'Please review'});assert.equal(row.amount,500);assert.equal(row.broker_user_id,broker);
 assert.equal((await call('SUBMIT',{request_id:first,contract_id:contract,note:'Please review'})).id,first);
 await denied(()=>call('SUBMIT',{request_id:second,contract_id:contract}));
 await denied(()=>call('SUBMIT',{request_id:second,contract_id:contract,amount:1}));
 await denied(()=>call('DECIDE',{request_id:first,status:'approved'}));
 await denied(()=>db.query('select * from portal_private.broker_payout_requests'));
 await actor(other);assert.equal((await call('LIST')).total,0);assert.deepEqual((await call('LIST')).eligible_contract_ids,[]);
 await denied(()=>call('SUBMIT',{request_id:second,contract_id:contract}));await denied(()=>call('LIST',{broker_user_id:broker}));
 for(const id of [ids.employee,ids.owner,ids.manager]){await actor(id);await denied(()=>call('LIST'));}
 await actor(ids.admin);assert.equal((await call('LIST')).total,1);await denied(()=>call('DECIDE',{request_id:first,status:'rejected'}));
 row=await call('DECIDE',{request_id:first,status:'rejected',note:'Missing evidence'});assert.equal(row.history.length,2);
 await actor(broker);row=await call('SUBMIT',{request_id:second,contract_id:contract});assert.equal(row.status,'pending');
 await db.exec('reset role');await db.query('update public.contracts set rent_amount=6000 where id=$1',[contract]);await actor(ids.ceo);
 await denied(()=>call('DECIDE',{request_id:second,status:'approved'}));await call('DECIDE',{request_id:second,status:'rejected',note:'Amount changed'});
 await actor(broker);await call('SUBMIT',{request_id:third,contract_id:contract});await actor(ids.ceo);
 row=await call('DECIDE',{request_id:third,status:'approved',note:'Checked'});assert.equal(row.amount,600);assert.equal(row.history.length,2);
 assert.equal((await call('DECIDE',{request_id:third,status:'approved',note:'Checked'})).history.length,2);
 await actor(ids.admin);await denied(()=>call('DECIDE',{request_id:third,status:'rejected',note:'Too late'}));
 await actor(broker);assert.equal((await call('LIST')).total,3);assert.equal((await call('LIST',{status:'approved'})).total,1);assert.equal((await call('LIST',{page:1})).requests.length,0);
 await db.exec('reset role');assert.equal((await db.query('select payout_status from portal_private.broker_contract_links')).rows[0].payout_status,'pending');
 await db.query('update portal_private.accounts set is_active=false where user_id=$1',[broker]);await actor(broker);await denied(()=>call('LIST'));
 await actor(null,'anon');await denied(()=>call('LIST'));

 await db.exec('reset role');
 const alt='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',altAgreement='ffffffff-ffff-4fff-8fff-ffffffffffff';
 const fixed='20000000-0000-4000-8000-000000000001',office='20000000-0000-4000-8000-000000000002';
 await db.query("insert into public.contracts values($1,'FIXTURE-OTHER',5000,'2026-01-01','2026-12-31',1000)",[alt]);
 await db.query("insert into portal_private.broker_office_agreements values($1,$2,'FIXED',123.45,null)",[altAgreement,other]);
 await db.query("insert into portal_private.broker_contract_links(broker_user_id,contract_id,agreement_id,closed_at) values($1,$2,$3,now()-interval '1 day')",[other,alt,altAgreement]);
 await actor(other);assert.equal((await call('SUBMIT',{request_id:fixed,contract_id:alt})).amount,123.45);
 await actor(ids.admin);await call('DECIDE',{request_id:fixed,status:'rejected',note:'Revise basis'});
 await db.exec('reset role');await db.query("update portal_private.broker_office_agreements set commission_type='PERCENTAGE',commission_value=12.5,percentage_basis='OFFICE_COMMISSION' where id=$1",[altAgreement]);
 await actor(other);assert.equal((await call('SUBMIT',{request_id:office,contract_id:alt})).amount,125);
 await actor(ids.ceo);await call('DECIDE',{request_id:office,status:'approved'});

 console.log('PASS payout DB: own-only list, role/deactivation/direct-read denial, server-calculated amounts, replay/duplicates, rejection/resubmission, stale amount, executive decisions, history and no money transfer. Disposable database only.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1});
