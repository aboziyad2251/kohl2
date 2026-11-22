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

export async function POST(req: NextRequest) {
 try {
  const {client}=await requireIdentity(req,true);
  const raw=await req.text();
  if(raw.length>1024)throw new PortalError(413,'طلب كبير');
  const body=JSON.parse(raw);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(key=>!['contract_id','unit_id'].includes(key))
   || typeof body.contract_id!=='string' || typeof body.unit_id!=='string' || !uuid.test(body.contract_id) || !uuid.test(body.unit_id))throw new PortalError(400,'حدد العقد والوحدة.');
  const {data,error}=await client.rpc('link_leasing_contract_unit',{target_contract:body.contract_id,target_unit:body.unit_id});
  if(error)throw new PortalError(error.code==='42501'?403:error.code==='PT409'?409:['42883','PGRST202'].includes(error.code)?503:400,'تعذر الربط؛ تحقق من تطابق العقار وعدم وجود تعارض أو ربط سابق.');
  return json(data);
 } catch(error) {return apiError(error instanceof SyntaxError?new PortalError(400,'طلب غير صالح'):error);}
}
