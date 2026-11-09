import { NextRequest } from 'next/server';
import { requireIdentity,apiError,json,PortalError } from '@/lib/portal/server';
import { withAudit } from '@/lib/audit/server';
import { payoutAction,payoutQuery } from '@/lib/portal/payout-requests';
export const dynamic='force-dynamic';
async function perform(req:NextRequest,write:boolean){
  try{
    const {client,profile}=await requireIdentity(req);
    const role=profile.account.role;
    if(!['BROKER','ADMIN','CEO'].includes(role))throw new PortalError(403,'Access denied');
    const input=write?payoutAction.parse(await req.json()):{operation:'LIST',...payoutQuery.parse(Object.fromEntries(req.nextUrl.searchParams))};
    if(input.operation==='SUBMIT'&&role!=='BROKER')throw new PortalError(403,'Broker required');
    if(input.operation==='DECIDE'&&!['ADMIN','CEO'].includes(role))throw new PortalError(403,'Admin or CEO required');
    const {operation,...payload}=input;
    // Caller JWT reaches the RPC. No supplied actor or service-role identity.
    const {data,error}=await client.rpc('broker_payout_requests',{operation,payload});
    if(error)throw new PortalError(error.code==='42501'?403:['23505','40001'].includes(error.code)?409:400,'تعذر تنفيذ الطلب؛ حدّث القائمة وتحقق من أهلية العمولة. / Refresh requests and check commission eligibility.');
    return json(data);
  }catch(error){return apiError(error);}
}
export const GET=(req:NextRequest)=>perform(req,false);
export const POST=withAudit((req:NextRequest)=>perform(req,true));
