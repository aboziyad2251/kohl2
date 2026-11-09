import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, json, PortalError } from '@/lib/portal/server';
import { requireInternal } from '@/lib/navigation/require-internal';
async function PATCHHandler(req:NextRequest,{params}:{params:{id:string}}){try{
 const {client,profile}=await requireInternal(req);
 if(profile.account.role==='HR'||profile.account.history_only)throw new PortalError(403,'لا تملك صلاحية الأجندة');
 const id=z.string().uuid().parse(params.id),input=z.object({status:z.enum(['PENDING','COMPLETED'])}).strict().parse(await req.json());
 const {data,error}=await client.from('kr_agenda_tasks').update(input).eq('id',id).eq('is_current',true).select('id,status').maybeSingle();
 if(error||!data)throw new PortalError(403,'تعذر تحديث بند الأجندة');return json({task:data});
}catch(e){return apiError(e);}}

export const PATCH=withAudit(PATCHHandler);
