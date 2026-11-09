const assert=require('assert/strict');const {fixture,migrate,actor,ids}=require('./fixtures/erp-db.cjs');
(async()=>{const db=await fixture();await migrate(db,'20261028131651_comprehensive_audit_trail.sql');
 await actor(db,'employee');const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';await db.query('insert into public.lessors values($1,$2)',[owner,'Synthetic owner']);
 assert.equal((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n,0);
 await assert.rejects(db.query("insert into public.audit_logs(action_type,module) values('LOGIN','Auth')"),/permission denied/);
 await assert.rejects(db.query('select public.record_audit_event($1,\'LOGIN\',\'Auth\')',[ids.admin]),/permission denied/);
 await db.query('update public.lessors set name=$1 where id=$2',['Renamed fixture',owner]);
 await actor(db,'admin');let logs=(await db.query('select * from public.audit_logs order by created_at')).rows;assert.equal(logs.length,2);assert.equal(logs[1].user_id,ids.employee);assert.equal(logs[1].details.changes.name.before,'Synthetic owner');assert.equal(logs[1].details.changes.name.after,'Renamed fixture');
 await assert.rejects(db.query('delete from public.audit_logs'),/permission denied/);
 await assert.rejects(db.query("update public.audit_logs set details='{}'"),/permission denied/);
 await actor(db,'admin','service_role');await db.query("select public.audit_access($1,'SET',$2)",[ids.admin,JSON.stringify({user_id:ids.manager,enabled:true})]);
 await assert.rejects(db.query("select public.audit_access($1,'SET',$2)",[ids.manager,JSON.stringify({user_id:ids.employee,enabled:true})]),/Executive required/);
 await db.query("select public.record_audit_event($1,'LOGIN','Auth',null,$2,null,null,null,$3)",[null,JSON.stringify({source:'password_login',outcome:'FAILURE',password:'NEVER_STORE',deep:{refresh_token:'NEVER_STORE'}}),'attempt@fixture.invalid']);
 await actor(db,'manager');assert((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n>2);
 await actor(db,'admin','service_role');await db.query("select public.audit_access($1,'SET',$2)",[ids.admin,JSON.stringify({user_id:ids.manager,enabled:false})]);
 await actor(db,'manager');assert.equal((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n,0);
 await db.exec('reset role');await db.query("insert into auth.audit_log_entries(payload,ip_address) values($1,'192.0.2.1')",[JSON.stringify({action:'login',actor_id:ids.admin,actor_username:'admin@fixture.invalid'})]);
 logs=(await db.query('select * from public.audit_logs order by created_at')).rows;assert(logs.some(l=>l.details.source==='supabase_auth'&&l.action_type==='LOGIN'));assert(!JSON.stringify(logs).includes('NEVER_STORE'));
 // A rolled-back business mutation must not leave a success audit row.
 const before=logs.length;await db.exec('begin');await db.query("insert into public.lessors(name) values('Rollback fixture')");await db.exec('rollback');assert.equal((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n,before);
 // Service actors come only from trusted server headers; normal users cannot forge them.
 await actor(db,'employee');await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-kohl-audit-actor':ids.admin})]);await db.query("insert into public.lessors(name) values('No spoof')");await actor(db,'admin');assert.equal((await db.query("select user_id from public.audit_logs where details->'changes'->'name'->>'after'='No spoof'")).rows[0].user_id,ids.employee);
 await actor(db,'owner');assert.equal((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n,0);
 console.log('PASS audit DB: append-only/RLS, actual diffs, actor anti-spoofing, future manager grant/revoke, Auth events, recursive secret redaction and transactional rollback.');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1});
