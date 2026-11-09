// Local interactive/browser acceptance only. Never imported by the application.
const {loadTS}=require('../tests/load-ts.cjs');
const {payoutAction}=loadTS('lib/portal/payout-requests.ts');
async function install(context,{role,brokerId='00000000-0000-4000-8000-000000000001',store,commissions=[]}){
 await context.route('**/api/portal/payout-requests*',async route=>{
  const executive=['ADMIN','CEO'].includes(role),url=new URL(route.request().url());
  const respond=(status,data)=>route.fulfill({status,json:data});
  if(!executive&&role!=='BROKER')return respond(403,{error:'Access denied'});
  const own=store.requests.filter(r=>executive||r.broker_user_id===brokerId);
  if(route.request().method()==='GET'){
   const page=Number(url.searchParams.get('page')||0),status=url.searchParams.get('status')||'all';
   const filtered=own.filter(r=>status==='all'||r.status===status);
   return respond(200,{requests:filtered.slice(page*50,page*50+50).reverse(),total:filtered.length,page,eligible_contract_ids:executive?[]:commissions.filter(c=>c.closed_at&&c.amount>0&&c.status!=='paid'&&!own.some(r=>r.contract_id===c.contract_id&&r.status!=='rejected')).map(c=>c.contract_id)});
  }
  const parsed=payoutAction.safeParse(route.request().postDataJSON());if(!parsed.success)return respond(400,{error:'Invalid request'});
  const v=parsed.data,now=new Date().toISOString();
  if(v.operation==='SUBMIT'){
   if(role!=='BROKER')return respond(403,{error:'Broker required'});
   const c=commissions.find(c=>c.contract_id===v.contract_id&&c.closed_at&&c.amount>0&&c.status!=='paid');
   if(!c||own.some(r=>r.contract_id===v.contract_id&&r.status!=='rejected'))return respond(409,{error:'Request already exists or commission is ineligible'});
   const r={id:v.request_id,broker_user_id:brokerId,broker_name:'وسيط تجريبي',contract_id:c.contract_id,contract_number:c.number,amount:c.amount,status:'pending',note:v.note,created_at:now,decided_at:null,decision_note:'',history:[{status:'pending',actor_name:'وسيط تجريبي',note:v.note,at:now}]};
   store.requests.push(r);return respond(200,r);
  }
  if(!executive)return respond(403,{error:'Admin or CEO required'});
  const r=store.requests.find(r=>r.id===v.request_id);if(!r||r.status!=='pending')return respond(409,{error:'Request changed'});
  r.status=v.status;r.decided_at=now;r.decision_note=v.note;r.history.push({status:v.status,actor_name:role==='CEO'?'رئيس تنفيذي تجريبي':'مدير تجريبي',note:v.note,at:now});return respond(200,r);
 });
}
module.exports={install};
