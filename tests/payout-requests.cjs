const assert=require('assert/strict');
const {NextRequest}=require('next/server');
const {loadTS}=require('./load-ts.cjs');
let role='BROKER',calls=[],failure=null;
class PortalError extends Error{constructor(status,message){super(message);this.status=status;}}
const route=loadTS('app/api/portal/payout-requests/route.ts',{
 '@/lib/portal/server':{PortalError,requireIdentity:async()=>({profile:{account:{role}},client:{rpc:async(name,args)=>{calls.push({name,args});return {data:{requests:[],total:0},error:failure};}}}),json:data=>Response.json(data),apiError:error=>Response.json({error:error.status?error.message:'Invalid request'},{status:error.status||400})},
 '@/lib/audit/server':{withAudit:handler=>handler},
});
const id='11111111-1111-4111-8111-111111111111',contract='22222222-2222-4222-8222-222222222222';
const request=(method,body,query='')=>new NextRequest('http://localhost/api/portal/payout-requests'+query,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
(async()=>{
 let r=await route.GET(request('GET'));assert.equal(r.status,200);assert.deepEqual(JSON.parse(JSON.stringify(calls.pop())),{name:'broker_payout_requests',args:{operation:'LIST',payload:{page:0,status:'all'}}});
 const submit={operation:'SUBMIT',request_id:id,contract_id:contract,note:'Fixture request'};
 r=await route.POST(request('POST',submit));assert.equal(r.status,200);assert.equal(calls.pop().args.payload.contract_id,contract);
 for(const body of [{...submit,broker_user_id:contract},{...submit,amount:999},{...submit,actor:contract},{...submit,operation:'DECIDE',status:'approved'}]){r=await route.POST(request('POST',body));assert([400,403].includes(r.status));}
 assert.equal((await route.POST(request('POST',{operation:'DECIDE',request_id:id,status:'approved'}))).status,403);
 assert.equal(calls.length,0);
 for(const forbidden of ['OWNER','TENANT','EMPLOYEE','HR']){role=forbidden;assert.equal((await route.GET(request('GET'))).status,403);assert.equal((await route.POST(request('POST',submit))).status,403);}
 for(const executive of ['ADMIN','CEO']){role=executive;assert.equal((await route.POST(request('POST',submit))).status,403);assert.equal((await route.POST(request('POST',{operation:'DECIDE',request_id:id,status:'rejected',note:''}))).status,400);assert.equal((await route.POST(request('POST',{operation:'DECIDE',request_id:id,status:'approved',note:'Reviewed'}))).status,200);calls.pop();}
 assert.equal(calls.length,0);role='BROKER';
 assert.equal((await route.GET(request('GET',null,'?broker_user_id='+contract))).status,400);
 assert.equal((await route.GET(request('GET',null,'?page=-1'))).status,400);
 failure={code:'23505',message:'PRIVATE_DATABASE_DETAIL'};r=await route.POST(request('POST',submit));assert.equal(r.status,409);assert(!(await r.text()).includes('PRIVATE_DATABASE_DETAIL'));
 console.log('PASS payout API: caller-scoped RPC, role gates, actor/amount spoof rejection, reasons, pagination, conflict mapping and private-error redaction. RPC mocked; database tests require approval.');
})().catch(e=>{console.error(e);process.exitCode=1});
