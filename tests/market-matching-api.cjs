const assert=require('assert/strict'),{loadTS}=require('./load-ts.cjs');
let role='EMPLOYEE',calls=[],failure=false;
class PortalError extends Error{constructor(status,message){super(message);this.status=status;}}
const route=loadTS('app/api/matching/route.ts',{'@/lib/audit/server':{withAudit:f=>f},'@/lib/portal/server':{requireIdentity:async()=>{if(!role)throw new PortalError(401,'Sign in');return {profile:{account:{role}},client:{rpc:async(name,p)=>{calls.push({name,p});return failure?{error:{code:'PGRST202'}}:{data:{saved:true}};}}};},PortalError,json:d=>Response.json(d),apiError:e=>Response.json({error:e.message},{status:e.status||400})}});
(async()=>{for(const denied of [null,'OWNER','BROKER','TENANT','HR','LEASING']){role=denied;assert.equal((await route.GET(new Request('http://test/api/matching'))).status,denied?403:401);}assert.equal(calls.length,0);
role='EMPLOYEE';assert.equal((await route.GET(new Request('http://test/api/matching'))).status,200);
const send=body=>route.POST(new Request('http://test/api/matching',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}));
assert.equal((await send('{bad')).status,400);assert.equal((await send('x'.repeat(10001))).status,413);
assert.equal((await send({operation:'DELETE',payload:{}})).status,400);
const event={id:'11111111-1111-4111-8111-111111111111',request_id:'22222222-2222-4222-8222-222222222222',property_id:'33333333-3333-4333-8333-333333333333',stage:'REJECTED',reason:''};
assert.equal((await send({operation:'FEEDBACK',payload:event})).status,400);event.reason='Budget';assert.equal((await send({operation:'FEEDBACK',payload:event})).status,200);
assert.equal((await send({operation:'FEEDBACK',payload:{...event,actor:'forged'}})).status,400);
failure=true;assert.equal((await route.GET(new Request('http://test/api/matching'))).status,503);
console.log('PASS: matching API role boundaries, malformed/oversized input, strict payloads and fail-closed database errors');})().catch(e=>{console.error(e);process.exit(1)});
