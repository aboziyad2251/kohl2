import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { apiError, json, adminClient, PortalError } from '@/lib/portal/server';
import { executive, krWorkflow, readJson } from '@/lib/kr/server';
import { contentSchema, reportDate, assertTomorrow } from '@/lib/kr/schema';
import { collectReport } from '@/lib/kr/collect';
const schema=z.object({event_id:z.string().uuid(),report_date:reportDate,revision:z.number().int().positive().optional(),content:contentSchema}).strict();
async function POSTHandler(req:NextRequest) {
 try { const {user}=await executive(req),input=schema.parse(await readJson(req));assertTomorrow(input.content,input.report_date);
 const snapshot=await collectReport(adminClient(),input.report_date);
 const digest=createHash('sha256').update(JSON.stringify({report_date:input.report_date,content:input.content})).digest('hex');
 return json({report:await krWorkflow(user.id,'IMPORT',{...input,digest,facts:{...snapshot.facts,sources:[...snapshot.facts.sources,'JSON import (Claude/Hatif)']}})});
 }catch(e){if(e instanceof SyntaxError)return apiError(new PortalError(400,'JSON غير صالح'));return apiError(e);}
}

export const POST=withAudit(POSTHandler);
