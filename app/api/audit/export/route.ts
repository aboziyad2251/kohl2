import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity,apiError,json } from '@/lib/portal/server';
import { withAudit,recordAudit,auditModule } from '@/lib/audit/server';
const input=z.object({filename:z.string().max(180),record_id:z.string().max(300).nullable(),path:z.string().regex(/^\/[a-zA-Z0-9/_-]*$/).max(300)}).strict();
async function post(req:NextRequest){try{await requireIdentity(req);const value=input.parse(await req.json());await recordAudit('EXPORT',auditModule(value.path),{source:'export_request',filename:value.filename,path:value.path,outcome:'REQUESTED'},value.record_id);return json({recorded:true});}catch(e){return apiError(e);}}
export const POST=withAudit(post);
