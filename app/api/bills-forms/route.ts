import { NextRequest } from 'next/server';
import { requireIdentity, apiError, json, PortalError } from '@/lib/portal/server';
import { billSchema } from '@/lib/bills/model';
export const dynamic = 'force-dynamic';
export async function POST(req:NextRequest){try{
 const {client,profile} = await requireIdentity(req);
 if(!['ADMIN','CEO','EMPLOYEE'].includes(profile.account.role))throw new PortalError(403,'Operational staff only');
 const {requestId,form} = await req.json();
 if(typeof requestId!=='string'||! /^[0-9a-f-]{36}$/i.test(requestId))throw new PortalError(400,'Invalid request ID');
 const input=billSchema.parse(form);
 if(input.override&&!['ADMIN','CEO'].includes(profile.account.role))throw new PortalError(403,'Admin or CEO required');
 const {data,error}=await client.rpc('issue_bill_form',{request_id:requestId, payload:input});
 if(error)throw new PortalError(error.code==='42501'?403:error.code==='23505'?409:503,error.code==='23505'?'Document number already exists':'تعذر إصدار المستند. يلزم تفعيل قاعدة بيانات الفواتير أو مراجعة الصلاحيات.');
 return json(data);
 }catch(e){return apiError(e);}}
