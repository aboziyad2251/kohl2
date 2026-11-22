import { withAudit } from '@/lib/audit/server';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json, PortalError } from '@/lib/portal/server';
import { validatePeriod,parseRequirementFilters,matchesRequirements,AvailableUnit } from '@/lib/operations/availability';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
 try {
  const {client,profile}=await requireIdentity(req);
  if(!['ADMIN','CEO','EMPLOYEE','LEASING'].includes(profile.account.role))throw new PortalError(403,'غير مخول');
  const params=new URL(req.url).searchParams;
  const period={start:params.get('from') || '',end:params.get('to') || ''};
  try {validatePeriod(period);} catch {throw new PortalError(400,'حدد تاريخ بداية ونهاية صحيحين.');}
  let requirements;
  try{requirements=parseRequirementFilters(params);}catch{throw new PortalError(400,'حدد عدد الغرف والمداخل بأعداد صحيحة.');}
  const {data,error}=await client.rpc('leasing_unit_availability',{from_date:period.start,to_date:period.end});
  if(error)throw new PortalError(['42883','PGRST202','42P01'].includes(error.code)?503:error.code==='42501'?403:400,'تعذر التحقق من التوفر؛ لا تعتبر الوحدة متاحة قبل اكتمال الفحص.');
  if(!data||!Array.isArray(data.units))throw new PortalError(503,'تعذر قراءة التوفر.');
  const units=data.units.filter((unit:AvailableUnit)=>matchesRequirements(unit,requirements));
  const unknown=data.units.filter((unit:AvailableUnit)=>Object.keys(requirements).some(key=>unit[key as 'bedrooms'|'entrances']==null)).length;
  return json({...data,units,filters:requirements,unknown_specs_excluded:unknown});
 } catch(error) {return apiError(error);}
}

async function POSTHandler(req: NextRequest) {
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

const specs=z.object({unit_id:z.string().uuid(),bedrooms:z.number().int().min(1).max(100).nullable(),entrances:z.number().int().min(1).max(20).nullable()}).strict();
async function PATCHHandler(req:NextRequest){
 try{
  const {client}=await requireIdentity(req,true);
  const raw=await req.text();if(raw.length>1024)throw new PortalError(413,'طلب كبير');
  const parsed=specs.safeParse(JSON.parse(raw));if(!parsed.success)throw new PortalError(400,'تحقق من مواصفات الوحدة.');
  const {unit_id,bedrooms,entrances}=parsed.data;
  const {data,error}=await client.rpc('save_leasing_unit_specs',{target_unit:unit_id,room_count:bedrooms,entrance_count:entrances});
  if(error)throw new PortalError(error.code==='42501'?403:['42883','PGRST202'].includes(error.code)?503:400,'تعذر حفظ مواصفات الوحدة.');
  return json(data);
 }catch(error){return apiError(error instanceof SyntaxError?new PortalError(400,'طلب غير صالح'):error);}
}

export const POST=withAudit(POSTHandler);

export const PATCH=withAudit(PATCHHandler);
