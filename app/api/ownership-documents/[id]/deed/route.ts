import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminClient,apiError,json,PortalError,requireIdentity } from '@/lib/portal/server';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:{id:string}}){try{
 const {client,profile}=await requireIdentity(req);if(!['ADMIN','CEO','EMPLOYEE'].includes(profile.account.role)||profile.account.history_only)throw new PortalError(403,'لا تملك صلاحية الصك');
 if(!z.string().uuid().safeParse(params.id).success)throw new PortalError(404,'الصك غير موجود');
 const {data,error}=await client.from('ownership_documents').select('deed_object_path').eq('id',params.id).maybeSingle();if(error)throw new PortalError(503,'تعذر تحميل الصك');if(!data?.deed_object_path)throw new PortalError(404,'لا يوجد مرفق للصك');
 const signed=await adminClient().storage.from('ownership-deeds').createSignedUrl(data.deed_object_path,120);if(signed.error||!signed.data)throw new PortalError(503,'تعذر فتح الصك');const url=new URL(signed.data.signedUrl);return json({url:new URL(url.pathname+url.search,process.env.NEXT_PUBLIC_SUPABASE_URL).toString()});
}catch(error){return apiError(error);}}
