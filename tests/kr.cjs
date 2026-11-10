const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),{z,ZodError}=require('zod');
function load(file,mocks={},env={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>n in mocks?mocks[n]:n==='@/lib/audit/server'?{withAudit:h=>h,auditAccess:async()=>false,AUDIT_SKIP_HEADER:'x-kohl-audit-skip'}:n==='./import-model'?require('./load-ts.cjs').loadTS('lib/properties/import-model.ts'):require(n),Date,Intl,URL,URLSearchParams,Set,Map,Buffer,Response,Request,console,crypto:require('crypto').webcrypto,process:{env}});return exports;}
const dates=load('lib/navigation/workspace.ts');
const metrics=load('lib/dashboard/metrics.ts',{'@/lib/navigation/workspace':dates});
const kinds=load('lib/property-classification.ts');
const specs=load('lib/properties/specifications.ts',{'@/lib/property-classification':kinds});
const schema=load('lib/kr/schema.ts');
assert.equal(metrics.documentationMetrics([]).percentage,0);
const docs=metrics.documentationMetrics([{status:'Draft'},{status:'Active',ejar_contract_number:'EJ-123',ejar_sync_status:'LINKED'},{status:'Expired'},{status:'Active',is_archived:true,ejar_contract_number:'EJ-456',ejar_sync_status:'LINKED'}]);
assert.equal(docs.total,2);assert.equal(docs.percentage,50);
assert.equal(metrics.ejarLink({ejar_contract_number:'EJ-1',ejar_sync_status:'PENDING'}),'PENDING');
assert.equal(metrics.ejarLink({ejar_sync_status:'UNLINKED',ejar_status:'Pending'}),'PENDING');
assert.equal(metrics.ejarLink({ejar_contract_number:'EJ-123',ejar_sync_status:'LINKED',ejar_status:'Cancelled'}),'UNLINKED');
assert.equal(metrics.ejarLink({agreement_number:'internal',ejar_status:'Active'}),'UNLINKED');
assert.equal(metrics.brokerageLinkMetrics([]).label,'غير مرتبط بإيجار');
assert.equal(metrics.brokerageLinkMetrics([{ejar_contract_number:'EJ-123',ejar_sync_status:'LINKED'}]).state,'LINKED');
const now=new Date('2026-10-26T12:00:00+03:00');
assert.equal(metrics.agencyMetrics([],now).message,'لا توجد وكالات نشطة');
assert.equal(metrics.agencyMetrics([{status:'Expired',expiry_date:'2026-10-25'}],now).active,0);
assert.equal(metrics.agencyMetrics([{status:'Active',expiry_date:'2026-12-25'}],now).message,'جميع الوكالات سارية');
assert.equal(metrics.agencyMetrics([{status:'Active',expiry_date:'2026-10-27'}],now).expiring,1);
assert.equal(metrics.agencyMetrics([{status:'Active',expiry_date:'2026-02-30'}],now).active,0);
assert.equal(specs.specification({rooms:null,spreadsheet_details:{rooms:3}},'rooms'),3);
assert.equal(specs.specification({rooms:null,rooms_edited:true,spreadsheet_details:{rooms:3}},'rooms'),null);
assert.equal(specs.specification({rooms:0,spreadsheet_details:{rooms:3}},'rooms'),0);
assert.equal(specs.propertyPrice({price:null,spreadsheet_details:{price_text:'85,000 ر.س'}}),85000);
assert.equal(specs.propertyPrice({price:null,price_edited:true,spreadsheet_details:{price_text:'85000'}}),null);
assert.equal(specs.propertyPrice({price:null,spreadsheet_details:{price_text:'85000 - 95000'}}),null);
assert.equal(specs.displayValue(null),'—');assert.equal(specs.displayValue(0),'0');
assert.equal(specs.safeMediaUrl('javascript:alert(1)'),null);assert.equal(specs.safeMediaUrl('https://user:pass@example.invalid/x'),null);
assert.equal(specs.propertyBadge({property_kind:'FLOOR',property_use:'Residential'}),'دور · سكني');
assert(!specs.propertyPatchSchema.safeParse({rooms:-1}).success);assert(!specs.propertyPatchSchema.safeParse({price:-1}).success);assert(!specs.propertyPatchSchema.safeParse({ownership_document_id:'other'}).success);
assert(!schema.reportDate.safeParse('2026-02-30').success);assert.equal(schema.nextReportDay('2026-12-31'),'2027-01-01');
const action={id:'44444444-4444-4444-8444-444444444444',action:'Synthetic task',contact:'Fixture',owner:'Fixture User',due_at:'2026-10-27T00:15:00+03:00',indicator:'Done'};
const content=schema.emptyContent();content.tomorrow=[action];schema.assertTomorrow(content,'2026-10-26');
assert.throws(()=>schema.assertTomorrow({...content,tomorrow:[{...action,due_at:'2026-10-26T20:30:00Z'}]},'2026-10-26'));
assert.throws(()=>schema.assertTomorrow({...content,tomorrow:[action,action]},'2026-10-26'));
assert(!schema.contentSchema.safeParse({...content,financial:{received:999}}).success);
class PortalError extends Error{constructor(status,message){super(message);this.status=status;}}
let role='ADMIN',authenticated=true,historyOnly=false,rows={properties:[{id:'p'}],financial_transactions:[{id:'t',transaction_type:'INCOME',amount:500,tax_vat:75,net_profit:425}],crm_activities:[{id:'a',activity_type:'CALL',created_at:'2026-10-26T09:00:00Z',created_by_name:'هاتف · ربط تلقائي',lead_or_client_name:'Fixture',lead_id:'l',due_date:'2026-10-26'}],crm_leads:[{id:'l',name:'Fixture',lead_type:'TENANT',budget_max:50000}],managed_property_contracts:[],kr_agenda_tasks:[],task_delegations:[]};
let updateValues,queryError=false;
const client={rpc:async()=>({data:rows.crm_activities,error:null}),from(table){const q=new Proxy({}, {get(_,key){if(key==='then')return (yes,no)=>Promise.resolve({data:rows[table]||[],error:null}).then(yes,no);if(key==='update')return value=>{updateValues=value;return q};if(key==='maybeSingle')return async()=>({data:queryError?null:{id:'11111111-1111-4111-8111-111111111111',title:updateValues.property_name,...updateValues},error:queryError?{}:null});return()=>q;}});return q;}};
const identity=async(req,executive)=>{if(!authenticated)throw new PortalError(401,'Sign in');if(executive&&!['ADMIN','CEO'].includes(role))throw new PortalError(403,'Executive required');return {client,user:{id:'fixture-user'},profile:{account:{role,history_only:historyOnly}}};};
const server={PortalError,requireIdentity:identity,adminClient:()=>client,json:data=>Response.json(data),apiError:e=>Response.json({error:e.message},{status:e instanceof ZodError?400:e.status||500})};
(async()=>{
 const collector=load('lib/kr/collect.ts',{'server-only':{},'@/lib/portal/server':server,'./schema':schema});
 let snapshot=await collector.collectReport(client,'2026-10-26');
 assert.equal(snapshot.facts.financial.thirdParty,null);assert.equal(snapshot.facts.financial.officeRevenue,null);
 assert.equal(snapshot.content.communications.totalCalls,1);assert.equal(snapshot.content.communications.inbound,null);
 assert.equal(snapshot.content.contacts[0].category,'غير مصنف');assert.equal(snapshot.content.contacts[0].temperature,'غير مصنف');
 rows.financial_transactions[0].third_party_amount=100;
 rows.financial_transactions.push({id:'e',transaction_type:'EXPENSE',amount:10,tax_vat:0,net_profit:10});
 snapshot=await collector.collectReport(client,'2026-10-26');assert.equal(snapshot.facts.financial.officeRevenue,315);
 rows.financial_transactions=[];snapshot=await collector.collectReport(client,'2026-10-26');assert.equal(snapshot.facts.financial.received,0);
 const dashboard=load('app/api/workspace/dashboard-metrics/route.ts',{'@/lib/portal/server':server,'@/lib/navigation/require-internal':{requireInternal:identity},'@/lib/dashboard/metrics':metrics});
 let dashboardResponse=await dashboard.GET(new Request('http://local.invalid/api'));assert.equal(dashboardResponse.status,200);assert.equal((await dashboardResponse.json()).totalProperties,1);
 authenticated=false;assert.equal((await dashboard.GET(new Request('http://local.invalid/api'))).status,401);authenticated=true;
 const properties=load('app/api/properties/[id]/route.ts',{'@/lib/portal/server':server,'@/lib/properties/specifications':specs});
 const id='11111111-1111-4111-8111-111111111111';
 const request=body=>new Request('http://local.invalid/api',{method:'PATCH',body:JSON.stringify(body)});
 authenticated=false;assert.equal((await properties.PATCH(request({rooms:2}),{params:{id}})).status,401);authenticated=true;
 role='HR';assert.equal((await properties.PATCH(request({rooms:2}),{params:{id}})).status,403);role='EMPLOYEE';
 assert.equal((await properties.PATCH(request({rooms:2,price:85000}),{params:{id}})).status,200);assert.equal(updateValues.rooms,2);assert.equal(updateValues.rooms_edited,true);
 assert.equal((await properties.PATCH(request({rooms:2,ownership_document_id:id}),{params:{id}})).status,400);
 historyOnly=true;assert.equal((await properties.PATCH(request({rooms:2}),{params:{id}})).status,403);historyOnly=false;
 queryError=true;assert.equal((await properties.PATCH(request({rooms:2}),{params:{id}})).status,400);queryError=false;
 role='ADMIN';let operation,viewer=false;
 client.rpc=async(name,input)=>{if(name==='kr_report_access')return {data:input.operation==='CHECK'?['ADMIN','CEO'].includes(role)||viewer:[],error:null};operation=input.operation;return {data:{status:'PUBLISHED',content},error:null}};
 const krServer=load('lib/kr/server.ts',{'server-only':{},'@/lib/portal/server':server,'./schema':schema,'./collect':{collectReport:async()=>({content,facts:snapshot.facts})}});
 const kr=load('app/api/financials/kr/route.ts',{'@/lib/portal/server':server,'@/lib/kr/server':krServer,'@/lib/kr/schema':schema});
 const post=body=>new Request('http://local.invalid/api',{method:'POST',body:JSON.stringify(body)});
 assert.equal((await kr.POST(post({operation:'PREPARE',report_date:'2026-10-26'}))).status,200);assert.equal(operation,'PREPARE');
 assert.equal((await kr.POST(post({operation:'SAVE',report_date:'2026-10-26',revision:2,content}))).status,200);assert.equal(operation,'SAVE');
 for(const operation of ['REOPEN','SUBMIT','APPROVE','RETURN'])assert.equal((await kr.POST(post({operation,report_date:'2026-10-20',revision:2}))).status,400);
 assert.equal((await kr.GET({nextUrl:new URL('http://local.invalid/api?date=2026-10-20&revision=2')})).status,200);assert.equal(operation,'HISTORY');
 assert.equal((await kr.GET({nextUrl:new URL('http://local.invalid/api?date=2026-10-20&revision=bad')})).status,400);
 role='CEO';assert.equal((await kr.POST(post({operation:'SAVE',report_date:'2026-10-26',revision:1,content}))).status,200);
 role='EMPLOYEE';assert.equal((await kr.POST(post({operation:'PREPARE',report_date:'2026-10-26'}))).status,403);
 assert.equal((await kr.POST(post({operation:'REOPEN',report_date:'2026-10-20',revision:2,note:'Forbidden'}))).status,403);
 assert.equal((await kr.GET({nextUrl:new URL('http://local.invalid/api?date=2026-10-20&revision=2')})).status,403);
 viewer=true;assert.equal((await kr.GET({nextUrl:new URL('http://local.invalid/api?date=2026-10-20&revision=2')})).status,200);
 assert.equal((await kr.POST(post({operation:'SAVE',report_date:'2026-10-20',revision:2,content}))).status,403);
 const accessApi=load('app/api/financials/kr/access/route.ts',{'@/lib/portal/server':server,'@/lib/kr/server':krServer});
 assert.equal((await accessApi.GET(post({}))).status,403);assert.equal((await accessApi.PATCH(post({user_id:id,enabled:true}))).status,403);
 viewer=false;assert.equal((await kr.GET({nextUrl:new URL('http://local.invalid/api?date=2026-10-20')})).status,403);
 role='OWNER';viewer=true;assert.equal((await kr.GET({nextUrl:new URL('http://local.invalid/api?date=2026-10-20')})).status,403);viewer=false;
 role='ADMIN';assert.equal((await accessApi.GET(post({}))).status,200);assert.equal((await accessApi.PATCH(post({user_id:id,enabled:true}))).status,200);
 historyOnly=true;assert.equal((await kr.GET({nextUrl:new URL('http://local.invalid/api?date=2026-10-20')})).status,403);historyOnly=false;
 // Profile capabilities must come from the server grant, with strict fail-closed booleans.
 const me=load('app/api/portal/me/route.ts',{'@/lib/portal/server':server});
 const previousRpc=client.rpc;
 for(const [selectedRole,grantData,grantError,expected] of [
  ['ADMIN',false,null,true],['CEO',false,null,true],['EMPLOYEE',true,null,true],
  ['HR',true,null,true],['EMPLOYEE',false,null,false],['EMPLOYEE',{enabled:true},null,false],
  ['EMPLOYEE',true,{message:'Missing RPC'},false],['OWNER',true,null,false]
 ]){
  role=selectedRole;client.rpc=async()=>({data:grantData,error:grantError});
  const result=await me.GET(post({}));assert.equal(result.status,200);assert.equal((await result.json()).kr_reports,expected);
 }
 role='ADMIN';historyOnly=true;assert.equal((await (await me.GET(post({}))).json()).kr_reports,false);historyOnly=false;
 authenticated=false;assert.equal((await me.GET(post({}))).status,401);authenticated=true;client.rpc=previousRpc;
 const scheduler=load('app/api/financials/kr/scheduled/route.ts',{'@/lib/portal/server':server,'@/lib/kr/server':{krWorkflow:async()=>({ready:false})},'@/lib/kr/collect':{collectReport:()=>{throw Error('Must not collect when not due')}},'@/lib/kr/schema':schema,'@/lib/navigation/workspace':dates},{KR_SCHEDULER_SECRET:'s'.repeat(40)});
 assert.equal((await scheduler.POST(new Request('http://local.invalid/api',{method:'POST'}))).status,401);
 const response=await scheduler.POST(new Request('http://local.invalid/api',{method:'POST',headers:{authorization:'Bearer '+'s'.repeat(40)}}));assert.equal(response.status,200);assert.equal((await response.json()).skipped,true);
 console.log('PASS KR: Ejar evidence and percentages, agency expiry, legacy specs/nulls, media validation, Riyadh boundaries, ERP trust classification, Hatif unknowns, property API gates/save failures, report roles and scheduler authentication. Data mocked.');
})().catch(e=>{console.error(e);process.exitCode=1;});
