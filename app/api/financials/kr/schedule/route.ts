import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, json } from '@/lib/portal/server';
import { executive, krWorkflow, readJson } from '@/lib/kr/server';
const schema=z.object({enabled:z.boolean(),report_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).strict();
async function PATCHHandler(req:NextRequest){try{const {user}=await executive(req);return json({schedule:await krWorkflow(user.id,'SCHEDULE_SAVE',schema.parse(await readJson(req)))});}catch(e){return apiError(e);}}

export const PATCH=withAudit(PATCHHandler);
