import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError,json } from '@/lib/portal/server';
import { executive,reportAccess,readJson } from '@/lib/kr/server';
const input=z.object({user_id:z.string().uuid(),enabled:z.boolean()}).strict();
export async function GET(req:NextRequest){try{const {user}=await executive(req);return json({users:await reportAccess(user.id,'LIST')});}catch(e){return apiError(e);}}
async function PATCHHandler(req:NextRequest){try{const {user}=await executive(req);return json(await reportAccess(user.id,'SET',input.parse(await readJson(req))));}catch(e){return apiError(e);}}

export const PATCH=withAudit(PATCHHandler);
