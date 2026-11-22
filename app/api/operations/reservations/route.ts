import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity,apiError,json,PortalError } from '@/lib/portal/server';
import { validatePeriod } from '@/lib/operations/availability';
export const dynamic='force-dynamic';
const action=z.discriminatedUnion('action',[
 z.object({action:z.literal('reserve'),case_id:z.string().uuid(),unit_id:z.string().uuid(),from:z.string(),to:z.string()}).strict(),
 z.object({action:z.literal('extend'),case_id:z.string().uuid(),reason:z.string().trim().min(1).max(1000)}).strict(),
 z.object({action:z.literal('cancel'),case_id:z.string().uuid()}).strict(),
]);
export async function POST(req:NextRequest){
 try{
  const {client,profile}=await requireIdentity(req);
  if(!['ADMIN','CEO','EMPLOYEE','LEASING'].includes(profile.account.role))throw new PortalError(403,'غير مخول');
  const raw=await req.text();if(raw.length>8192)throw new PortalError(413,'طلب كبير');
  const parsed=action.safeParse(JSON.parse(raw));if(!parsed.success)throw new PortalError(400,'تحقق من بيانات الحجز.');
  const input=parsed.data;
  if(profile.account.role==='LEASING'&&input.action!=='reserve')throw new PortalError(403,'صلاحية أخصائي التأجير تقتصر على إنشاء الحجز.');
  if(input.action==='reserve'){
   try{validatePeriod({start:input.from,end:input.to});}catch{throw new PortalError(400,'حدد فترة صحيحة للحجز.');}
  }
  const call=input.action==='reserve'
   ?client.rpc('reserve_leasing_unit',{target_case:input.case_id,target_unit:input.unit_id,from_date:input.from,to_date:input.to})
   :input.action==='extend'?client.rpc('extend_leasing_hold',{target_case:input.case_id,reason:input.reason})
   :client.rpc('cancel_leasing_booking',{case_id:input.case_id});
  const {data,error}=await call;
  if(error)throw new PortalError(error.code==='42501'?403:error.code==='PT409'?409:['42883','PGRST202','42P01'].includes(error.code)?503:400,
   error.code==='42501'?'ليست لديك صلاحية تنفيذ هذا الإجراء.':error.code==='PT409'?'تغير التوفر أو لم يعد الحجز قابلاً لهذا الإجراء. أعد التحقق.':'تعذر تنفيذ إجراء الحجز.');
  return json(data);
 }catch(error){return apiError(error instanceof SyntaxError?new PortalError(400,'طلب غير صالح'):error);}
}

export async function GET(req:NextRequest){
 try{
  const {client,profile}=await requireIdentity(req);
  if(!['ADMIN','CEO','EMPLOYEE','LEASING'].includes(profile.account.role))throw new PortalError(403,'غير مخول');
  const {data,error}=await client.rpc('leasing_reservation_status');
  if(error)throw new PortalError(error.code==='42501'?403:503,'تعذر قراءة حالة الحجوزات.');
  return json(data);
 }catch(error){return apiError(error);}
}
