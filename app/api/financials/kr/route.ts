import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { apiError, json } from '@/lib/portal/server';
import { executive, management, krWorkflow, readJson, mutationSchema, prepare } from '@/lib/kr/server';
import { assertTomorrow, contentSchema, reportDate } from '@/lib/kr/schema';
import { z } from 'zod';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
 try { const {user,profile}=await management(req);const day=reportDate.parse(req.nextUrl.searchParams.get('date'));
 const version=req.nextUrl.searchParams.get('revision');
 if(version!==null)return json({snapshot:await krWorkflow(user.id,'HISTORY',{report_date:day,revision:z.coerce.number().int().positive().parse(version)})});
 const [report,recent,schedule]=await Promise.all([krWorkflow(user.id,'GET',{report_date:day}),krWorkflow(user.id,'RECENT'),krWorkflow(user.id,'SCHEDULE_GET')]);return json({report,recent,schedule,can_edit:['ADMIN','CEO'].includes(profile.account.role)}); }catch(e){return apiError(e);}
}
async function POSTHandler(req:NextRequest) {
 try { const {user}=await executive(req),input=mutationSchema.parse(await readJson(req));
 if(input.operation==='PREPARE')return json({report:await prepare(user.id,input.report_date,input.revision)});
 if(input.operation==='SAVE'){const content=contentSchema.parse(input.content);assertTomorrow(content,input.report_date);}
 return json({report:await krWorkflow(user.id,input.operation,input)}); }catch(e){return apiError(e);}
}

export const POST=withAudit(POSTHandler);
