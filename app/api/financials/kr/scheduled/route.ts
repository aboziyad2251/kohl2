import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { adminClient, apiError, json, PortalError } from '@/lib/portal/server';
import { krWorkflow } from '@/lib/kr/server';
import { collectReport } from '@/lib/kr/collect';
import { contentSchema } from '@/lib/kr/schema';
import { riyadhDay } from '@/lib/navigation/workspace';
export const dynamic='force-dynamic';
async function POSTHandler(req:NextRequest){try{
 const secret=process.env.KR_SCHEDULER_SECRET,received=req.headers.get('authorization')?.replace(/^Bearer /,'');
 if(!secret||secret.length<32)throw new PortalError(503,'جدولة KR غير مجهزة');
 if(!received||Buffer.byteLength(received)!==Buffer.byteLength(secret)||!timingSafeEqual(Buffer.from(received),Buffer.from(secret)))throw new PortalError(401,'Unauthorized');
 const ready=await krWorkflow(null,'SCHEDULE_READY');
 if(!ready.ready)return json({skipped:true});
 const now=new Date();
 const day=riyadhDay(now),snapshot=await collectReport(adminClient(),day);
 // Return no report/customer contents to the scheduler or its logs.
 const content=contentSchema.parse(snapshot.content);
 if(Buffer.byteLength(JSON.stringify(content))>1024*1024)throw new PortalError(413,'حجم التقرير يتجاوز الحد المسموح');
 const result=await krWorkflow(null,'SCHEDULE_RUN',{report_date:day,content,facts:snapshot.facts});
 return json({published:result.status==='PUBLISHED',skipped:!!result.skipped,date:day});
}catch(e){return apiError(e);}}

export const POST=withAudit(POSTHandler);
