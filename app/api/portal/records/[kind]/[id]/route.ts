import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity, apiError, json, PortalError } from '@/lib/portal/server';
import { workflow } from '@/lib/portal/workflow-server';
import type { PortalDashboard } from '@/lib/portal/workflows';
export const dynamic = 'force-dynamic';
export async function GET(_req: NextRequest,{params}:{params:{kind:string;id:string}}){
 try{
  const {user}=await requireIdentity(_req);
  if(!z.string().uuid().safeParse(params.id).success)throw new PortalError(404,'Record not found');
  const data=await workflow(user.id,'DASHBOARD') as PortalDashboard;
  const record=params.kind==='contract'?data.contracts.find(x=>x.id===params.id):params.kind==='property'?data.properties.find(x=>x.id===params.id):params.kind==='payment'?data.payments.find(x=>x.id===params.id):params.kind==='maintenance'?data.maintenance.find(x=>x.id===params.id):params.kind==='kpi'?data.kpis.find(x=>x.id===params.id):null;
  if(!record)throw new PortalError(404,'Record not found');
  return json(record);
 }catch(error){return apiError(error);}
}
