const assert=require('assert/strict'),{loadTS}=require('./load-ts.cjs');
const model=loadTS('lib/operations/model.ts');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const base={operation:'ENTRY_CREATE',id,case_id:id,kind:'RECEIPT',amount:10.01,date:'2026-11-10',holder:'OWNER',reference:'R',category:'Rent',note:''};
assert(model.operationAction.safeParse(base).success);
for(const amount of [0,-1,Infinity,0.001])assert(!model.operationAction.safeParse({...base,amount}).success);
assert(!model.operationAction.safeParse({...base,actor:id}).success);
assert(!model.periodSchema.safeParse({from:'2026-11-11',to:'2026-11-10'}).success);
assert(!model.periodSchema.safeParse({from:'2026-02-30',to:'2026-03-01'}).success);
const w={cases:[],dues:[{case_id:id,amount:100,due_date:'2026-11-10',voided:false}],followups:[{due_at:'2026-11-10T09:00:00Z',completed_at:'2026-11-10T10:00:00Z',blocked_by:'MANAGEMENT'}],units:[],entries:[{...base,status:'APPROVED',amount:60},{...base,status:'APPROVED',kind:'DEPOSIT_IN',amount:300},{...base,status:'PENDING',amount:40}]};
const m=model.metrics(w,'2026-11-10','2026-11-10',new Date('2026-11-10T12:00:00Z'));
assert.equal(m.received,60);assert.equal(m.depositsIn,300);assert.equal(m.outstanding[0].balance,40);assert.equal(m.followupRate,0);assert.equal(m.blocked,1);
const term=(id,kind,end_date,stage='CONFIRMED')=>({id,kind,end_date,stage});
const alerts=model.termAlerts([
 term('daily','DAILY','2026-11-14'),term('late','MONTHLY','2026-11-09'),
 term('annual','ANNUAL','2026-12-11'),term('monthly','MONTHLY','2026-11-18'),
 term('too-far','DAILY','2026-11-15'),term('cancelled','ANNUAL','2026-11-11','CANCELLED'),
 term('missing','MONTHLY',null),term('annual-far','ANNUAL','2026-12-12')
],new Date('2026-11-10T21:05:00Z'));
assert.deepEqual(alerts.map(a=>a.item.id),['late','daily','monthly','annual']);
assert.equal(alerts[0].days,-2);
assert.equal(alerts[1].action,'تنسيق المغادرة أو التمديد');
assert.equal(model.termAlerts([term('today','DAILY','2026-11-11')],new Date('2026-11-10T21:05:00Z'))[0].days,0);
let role='EMPLOYEE',rpcPayload,rpcError=null;
const mocks={'@/lib/audit/server':{withAudit:f=>f},'@/lib/portal/server':{requireIdentity:async()=>({profile:{account:{role}},client:{rpc:async(name,args)=>{rpcPayload={name,...args};return {data:{saved:true},error:rpcError};}}}),PortalError:class extends Error{constructor(status,message){super(message);this.status=status;}},json:data=>Response.json(data),apiError:e=>Response.json({error:e.message},{status:e.status||400})}};
const route=loadTS('app/api/operations/route.ts',mocks);
(async()=>{
 let res=await route.POST(new Request('http://test/api/operations',{method:'POST',body:JSON.stringify(base)}));assert.equal(res.status,200);assert.equal(rpcPayload.name,'kohl_operations');assert.equal(rpcPayload.payload.holder,'OWNER');
 rpcError={code:'PT409'};res=await route.POST(new Request('http://test/api/operations',{method:'POST',body:JSON.stringify(base)}));assert.equal(res.status,409);rpcError=null;
 role='OWNER';res=await route.GET(new Request('http://test/api/operations'));assert.equal(res.status,403);
 role='EMPLOYEE';res=await route.POST(new Request('http://test/api/operations',{method:'POST',body:JSON.stringify({...base,actor:id})}));assert.equal(res.status,400);

 const oldFlag=process.env.KOHL_OPERATIONS_KR_ENABLED;process.env.KOHL_OPERATIONS_KR_ENABLED='true';
 try{
  const collector=loadTS('lib/kr/collect.ts',mocks);
  const query={order(){return this;},range:async()=>({data:[],error:null}),or(){return this;},eq(){return this;},gte(){return this;},lte(){return this;}};
  const client={from:()=>({select:()=>query}),rpc:async(name)=>({data:name==='operations_kr_summary'?{cases:2,followups_due:3,followups_done:1,received:100,expenses:10,deposits:20,pending:1}:[],error:null})};
  let report=await collector.collectReport(client,'2026-11-10');
  assert(report.content.operationalNotes.some(n=>n.includes('100')));
  assert.equal(report.facts.financial.received,0,'new ledger must not double count legacy financial totals');
  client.rpc=async()=>({data:null,error:{code:'unavailable'}});
  report=await collector.collectReport(client,'2026-11-10');assert(report.facts.warnings.some(n=>n.includes('المالية الداخلية')));
 }finally{if(oldFlag===undefined)delete process.env.KOHL_OPERATIONS_KR_ENABLED;else process.env.KOHL_OPERATIONS_KR_ENABLED=oldFlag;}
 console.log('Operations schemas, scoped API and money/KPI calculations passed');
})().catch(e=>{console.error(e);process.exit(1);});
