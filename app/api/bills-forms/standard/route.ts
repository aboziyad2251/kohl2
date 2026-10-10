import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json, PortalError } from '@/lib/portal/server';
import { standardSchema } from '@/lib/forms/model';
import { z } from 'zod';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){try{
 const {client,profile}=await requireIdentity(req);
 if(!['ADMIN','CEO','EMPLOYEE'].includes(profile.account.role))throw new PortalError(403,'Operational staff only');
 const body=await req.json().catch(()=>{throw new PortalError(400,'Invalid JSON');});
 const {requestId,form:input}=z.object({requestId:z.string().uuid(),form:standardSchema}).strict().parse(body);
 if(input.override&&!['ADMIN','CEO'].includes(profile.account.role))throw new PortalError(403,'Admin or CEO required');
 const {data,error}=await client.rpc('issue_standard_form',{request_id:requestId,payload:input});
 if(error)throw new PortalError(error.code==='42501'?403:error.code==='23505'?409:error.code==='22023'?400:503,error.code==='23505'?'رقم المستند مستخدم بالفعل':error.code==='22023'?'راجع متغيرات المستند':'تعذر إصدار المستند. يلزم تفعيل إضافة النماذج في قاعدة البيانات.');
 return json(data);
 }catch(e){return apiError(e);}}
