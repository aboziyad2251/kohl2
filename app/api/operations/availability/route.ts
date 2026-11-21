import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json, PortalError } from '@/lib/portal/server';
import { validatePeriod } from '@/lib/operations/availability';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
 try {
  const {client,profile}=await requireIdentity(req);
  if(!['ADMIN','CEO','EMPLOYEE','LEASING'].includes(profile.account.role))throw new PortalError(403,'غير مخول');
  const params=new URL(req.url).searchParams;
  const period={start:params.get('from') || '',end:params.get('to') || ''};
  try {validatePeriod(period);} catch {throw new PortalError(400,'حدد تاريخ بداية ونهاية صحيحين.');}
  const {data,error}=await client.rpc('leasing_unit_availability',{from_date:period.start,to_date:period.end});
  if(error)throw new PortalError(['42883','PGRST202','42P01'].includes(error.code)?503:error.code==='42501'?403:400,'تعذر التحقق من التوفر؛ لا تعتبر الوحدة متاحة قبل اكتمال الفحص.');
  return json(data);
 } catch(error) {return apiError(error);}
}
