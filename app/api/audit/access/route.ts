import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity,apiError,json,PortalError } from '@/lib/portal/server';
import { auditAccess,withAudit } from '@/lib/audit/server';
async function executive(req:NextRequest){const actor=await requireIdentity(req,true);if(actor.profile.account.history_only)throw new PortalError(403,'Read-only account');return actor;}
export async function GET(req:NextRequest){try{const {user}=await executive(req);return json({users:await auditAccess(user.id,'LIST')});}catch(e){return apiError(e);}}
async function patch(req:NextRequest){try{const {user}=await executive(req),input=z.object({user_id:z.string().uuid(),enabled:z.boolean()}).strict().parse(await req.json());return json(await auditAccess(user.id,'SET',input));}catch(e){return apiError(e);}}
export const PATCH=withAudit(patch);
