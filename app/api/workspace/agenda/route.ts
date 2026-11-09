import { NextRequest } from 'next/server';
import { apiError, json, PortalError } from '@/lib/portal/server';
import { requireInternal } from '@/lib/navigation/require-internal';
import { reportDate } from '@/lib/kr/schema';
export async function GET(req:NextRequest){try{
 const {client,profile}=await requireInternal(req);
 if(profile.account.role==='HR'||profile.account.history_only)throw new PortalError(403,'لا تملك صلاحية الأجندة');
 const day=reportDate.parse(req.nextUrl.searchParams.get('date'));
 const {data,error}=await client.from('kr_agenda_tasks').select('id,action,contact,owner,assigned_user_id,due_at,indicator,status').eq('due_date',day).eq('is_current',true).order('due_at').order('id').limit(501);
 if(error)throw new PortalError(503,'تعذر تحميل أجندة KR');
 return json({tasks:(data||[]).slice(0,500),limited:(data||[]).length>500});
}catch(e){return apiError(e);}}
