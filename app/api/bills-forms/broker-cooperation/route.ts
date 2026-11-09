import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity,apiError,json,PortalError } from '@/lib/portal/server';
import { withAudit,recordAudit } from '@/lib/audit/server';
import { brokerSummarySchema } from '@/lib/forms/broker-summary';
async function post(req:NextRequest){try{
 const {client,profile}=await requireIdentity(req);if(!['ADMIN','CEO','EMPLOYEE'].includes(profile.account.role)||profile.account.history_only)throw new PortalError(403,'Operational staff only');
 const raw=await req.text();if(Buffer.byteLength(raw)>20000)throw new PortalError(413,'Request too large');
 const {requestId,form}=z.object({requestId:z.string().uuid(),form:brokerSummarySchema}).strict().parse(JSON.parse(raw));
 const {data,error}=await client.rpc('issue_broker_summary',{request_id:requestId,payload:form});
 if(error)throw new PortalError(error.code==='42501'?403:error.code==='40001'?409:503,'تعذر إصدار الملخص؛ راجع البيانات والصلاحيات وتجهيز قاعدة البيانات.');
 await recordAudit('FORM_SUBMIT','Broker Cooperation',{source:'broker_summary','templateVersion':3,outcome:'SUCCESS'},requestId);
 return json(data);
 }catch(e){return apiError(e);}}
export const POST=withAudit(post);
