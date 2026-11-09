import { NextRequest } from 'next/server';
import { commitInput } from '@/lib/properties/import-model';
import { importActor,importRpc,importJson } from '@/lib/properties/import-server';
import { withAudit } from '@/lib/audit/server';
import { apiError,json } from '@/lib/portal/server';
async function post(req:NextRequest){try{const {user}=await importActor(req),input=commitInput.parse(await importJson(req,200000));return json(await importRpc('commit_property_import',{actor:user.id,request_id:input.request_id,decisions:input.decisions}));}catch(e){return apiError(e);}}
export const POST=withAudit(post);
