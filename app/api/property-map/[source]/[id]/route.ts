import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError,json,PortalError,requireIdentity } from '@/lib/portal/server';
import { mapSourceSchema,mapUpdateSchema,managedMapUpdateSchema } from '@/lib/property-map';
export const dynamic='force-dynamic';
async function PATCHHandler(req:NextRequest,{params}:{params:{source:string;id:string}}) {
  try{
    const {client,profile}=await requireIdentity(req);
    if(!['ADMIN','CEO','EMPLOYEE'].includes(profile.account.role)||profile.account.history_only)throw new PortalError(403,'لا تملك صلاحية تعديل خريطة العقارات');
    const source=mapSourceSchema.parse(params.source),id=z.string().uuid().parse(params.id);
    const table=source==='PROPERTY'?'properties':'managed_property_contracts';
    const {data:property,error:readError}=await client.from(table).select('id').eq('id',id).maybeSingle();
    if(readError)throw new PortalError(503,'تعذر تحميل العقار');
    if(!property)throw new PortalError(404,'العقار غير موجود أو غير مصرح به');
    const reader=req.body?.getReader();if(!reader)throw new PortalError(400,'طلب فارغ');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>8192){await reader.cancel();throw new PortalError(413,'طلب كبير');}chunks.push(item.value);}
    let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new PortalError(400,'بيانات غير صالحة');}
    const payload=(source==='PROPERTY'?mapUpdateSchema:managedMapUpdateSchema).parse(body);
    const {data,error}=await client.from(table).update(payload).eq('id',id).select('id').single();
    if(error||!data)throw new PortalError(403,'تعذر حفظ إعدادات خريطة العقار');
    return json({saved:true});
  }catch(error){return apiError(error);}
}

export const PATCH=withAudit(PATCHHandler);
