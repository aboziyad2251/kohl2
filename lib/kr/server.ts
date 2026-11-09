import 'server-only';
import { NextRequest } from 'next/server';
import { adminClient, requireIdentity, PortalError } from '@/lib/portal/server';
import { z } from 'zod';
import { assertTomorrow, contentSchema, reportDate } from './schema';
import { collectReport } from './collect';
export async function executive(req:NextRequest) { const identity=await requireIdentity(req,true); if(identity.profile.account.history_only) throw new PortalError(403,'حساب للاطلاع فقط'); return identity; }
export async function reportAccess(actor:string,operation='CHECK',payload:unknown={}) {
  const {data,error}=await adminClient().rpc('kr_report_access',{actor,operation,payload});
  if(error)throw new PortalError(503,'تعذر التحقق من صلاحية تقارير الإدارة.');return data;
}
export async function management(req:NextRequest){const identity=await requireIdentity(req);if(identity.profile.account.history_only||!['ADMIN','CEO','HR','EMPLOYEE'].includes(identity.profile.account.role)||await reportAccess(identity.user.id)!==true)throw new PortalError(403,'التقرير متاح للإدارة المخولة فقط');return identity;}
export async function krWorkflow(actor:string|null,operation:string,payload:unknown={}) {
  const {data,error}=await adminClient().rpc('kr_workflow',{actor,operation,payload});
  if(error) throw new PortalError(error.code==='42501'?403:error.code==='40001'?409:error.code==='P0002'?404:503,error.code==='40001'?'تغير التقرير؛ أعد تحميله قبل حفظ التعديلات.':'تعذر تنفيذ إجراء التقرير. تحقق من تجهيز قاعدة البيانات والصلاحيات.');
  return data;
}
export async function readJson(req:NextRequest) {
  const chunks:Uint8Array[]=[]; let size=0;
  const reader=req.body?.getReader(); if(!reader) throw new PortalError(400,'الطلب فارغ');
  while(true) { const part=await reader.read(); if(part.done)break; size+=part.value.length; if(size>1024*1024){await reader.cancel();throw new PortalError(413,'تجاوز حجم JSON المسموح (1 MB)');}chunks.push(part.value); }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PortalError(400,'JSON غير صالح');}
}
export const mutationSchema=z.object({operation:z.enum(['PREPARE','SAVE']),report_date:reportDate,revision:z.number().int().positive().optional(),content:contentSchema.optional()}).strict();
export async function prepare(actor:string,day:string,revision?:number, content?:unknown) {
  const snapshot=await collectReport(adminClient(),day);
  const parsed=contentSchema.parse(content||snapshot.content);assertTomorrow(parsed,day);
  if(Buffer.byteLength(JSON.stringify(parsed))>1024*1024)throw new PortalError(413,'حجم التقرير يتجاوز1 MB؛ قسم البيانات قبل المتابعة.');
  return krWorkflow(actor,'PREPARE',{report_date:day,revision,content:parsed,facts:snapshot.facts});
}
