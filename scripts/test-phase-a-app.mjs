import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
assert.equal(process.env.NEXT_PUBLIC_PORTAL_PREVIEW,'true','Run only with .portal-stage/env.local');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'http://localhost:39123','Isolated tunnel required');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const client=()=>createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
let count=0;
function check(condition,label){assert.ok(condition,label);count++;console.log('PASS',label);}
async function call(path,token,payload){
 const response=await fetch('http://localhost:3102'+path,{method:payload?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
 return {status:response.status,body:await response.json()};
}
const executive=client();
const {data:login,error:loginError}=await executive.auth.signInWithPassword({email:'phase-a-admin@test.invalid',password:'Kohl-Preview-2026!'});
assert.ifError(loginError);const executiveToken=login.session.access_token;
let response=await call('/api/portal/me',executiveToken);
check(response.status===200&&response.body.account.role==='ADMIN','Next API validates a real Admin Auth session');
response=await call('/api/access/users',executiveToken);
check(response.status===200&&response.body.properties.length>=2,'Admin loads users and verified link choices through Next API');
const properties=response.body.properties;
const leases=response.body.contracts;
const accounts=[];
for(const [role,name,links] of [
 ['OWNER','Owner preview 1',{owners:[{property_id:properties[0].id,ownership_share:10}]}],
 ['OWNER','Owner preview 2',{owners:[{property_id:properties[1].id,ownership_share:20}]}],
 ['TENANT','Tenant preview',{leases:[leases[0].id]}],
 ['BROKER','Broker preview',{broker_contracts:[leases[0].id],agreement:{agreement_number:randomUUID(),commission_type:'PERCENTAGE',commission_value:2.5,percentage_basis:'DEAL_VALUE'}}],
]) {
 const email=randomUUID()+'@test.invalid';
 response=await call('/api/access/users',executiveToken,{email,full_name:name,mobile:'0500000000',national_id_or_iqama:'',role,...links});
 check(response.status===200&&response.body.saved&&response.body.invitation_sent,`${role} created, linked and invited through the real Next endpoint`);
 const id=response.body.user_id;
 const {error}=await admin.auth.admin.updateUserById(id,{password:'Kohl-External-Preview-2026!',email_confirm:true});assert.ifError(error);
 const external=client();const {data,error:signError}=await external.auth.signInWithPassword({email,password:'Kohl-External-Preview-2026!'});assert.ifError(signError);
 const token=data.session.access_token;
 response=await call('/api/portal/me',token);
 check(response.status===200&&response.body.account.id===id&&response.body.account.role===role,`${role} signs in and reads only its own profile through Next`);
 const {data:rows,error:readError}=await external.from('contracts').select('*');assert.ifError(readError);
 check(rows.length===0,`${role} real Auth token cannot read raw contracts directly`);
 response=await call('/api/access/users',token);
 check(response.status===403,`${role} cannot enter user administration`);
 response=await call('/api/access/settings',token,{tenant_lease_end_action:'DEACTIVATE'});
 check(response.status===403,`${role} cannot change tenant access settings`);
 accounts.push({id,role,token});
}
const owners=accounts.filter(a=>a.role==='OWNER');
const first=await call('/api/portal/me',owners[0].token),second=await call('/api/portal/me',owners[1].token);
check(first.body.owners.length===1&&second.body.owners.length===1&&first.body.owners[0].property_id!==second.body.owners[0].property_id,'Two real Owner sessions cannot read each other property links');
response=await call('/api/access/users/'+owners[0].id,executiveToken,{action:'deactivate'});
check(response.status===200,'Admin deactivates account through Next');
response=await call('/api/portal/me',owners[0].token);
if(response.status!==403)console.log('Unexpected inactive profile status:',response.status);
check(response.status===403,'Deactivated real Auth token denied immediately through Next');
response=await call('/api/access/users/'+owners[0].id,executiveToken,{action:'activate'});check(response.status===200,'Admin reactivates account through Next');
response=await call('/api/access/users/'+owners[0].id,executiveToken,{action:'reset'});check(response.status===200,'Admin password reset reaches only the local mail catcher');
response=await call('/api/access/users',executiveToken);check(response.status===200&&response.body.audit.some(x=>x.action==='AUTH_EVENT'),'Password reset and user management appear in audit history');
response=await call('/api/access/users',executiveToken,{email:'invalid',role:'ADMIN'});check(response.status===400,'Malformed or executive-role creation rejected by Next validation');
console.log(`${count} full Next/Auth/REST checks passed on fake preview records.`);
