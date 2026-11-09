import { NextRequest } from 'next/server';
import { apiError,json,PortalError,requireIdentity } from '@/lib/portal/server';
import { MapEntry,MapSource } from '@/lib/property-map';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest) {
  try {
    const { client,profile }=await requireIdentity(req);
    if(!['ADMIN','CEO','EMPLOYEE'].includes(profile.account.role)||profile.account.history_only)throw new PortalError(403,'لا تملك صلاحية عرض خريطة العقارات');
    const definitions:[MapSource,string,string][]=[
      ['PROPERTY','properties','id,property_name,city,address,property_type,units_count,status,latitude,longitude,map_purposes,map_visible'],
      ['MANAGED','managed_property_contracts','id,property_name,city,address,property_type,total_units,status,latitude,longitude,map_purposes,map_visible'],
    ];
    const sets=await Promise.all(definitions.map(async([source,table,columns])=>{
      const entries:MapEntry[]=[];
      // Read through the user's RLS client, without local demo/cache fallbacks.
      for(let page=0;page<100;page++){
        const {data,error}=await client.from(table).select(columns).order('id').range(page*500,page*500+499);
        if(error)throw new PortalError(503,'تعذر تحميل عقارات الخريطة. حاول التحديث');
        for(const row of data||[]) {
          const value=row as unknown as Record<string,unknown>;
          entries.push({id:String(value.id),source,title:String(value.property_name),city:String(value.city||''),address:String(value.address||''),property_type:String(value.property_type),units_count:Number(value.units_count??value.total_units??0),status:value.status==null?null:String(value.status),latitude:value.latitude==null?null:Number(value.latitude),longitude:value.longitude==null?null:Number(value.longitude),map_purposes:(value.map_purposes||[]) as MapEntry['map_purposes'],map_visible:value.map_visible===true});
        }
        if((data||[]).length<500)return entries;
      }
      throw new PortalError(413,'عدد العقارات كبير. يرجى التواصل مع الإدارة');
    }));
    return json({entries:sets.flat(),updated_at:new Date().toISOString()});
  }catch(error){return apiError(error);}
}
