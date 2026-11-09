import { NextRequest } from 'next/server';
import { previewInput } from '@/lib/properties/import-model';
import { buildPreview } from '@/lib/properties/import-match';
import { importActor,importContext,importRpc,importJson } from '@/lib/properties/import-server';
import { withAudit } from '@/lib/audit/server';
import { apiError,json,PortalError } from '@/lib/portal/server';
async function post(req:NextRequest){try{const {user}=await importActor(req);const input=previewInput.parse(await importJson(req)),context=await importContext(user.id);const rows=buildPreview(input.rows,context);const plan={...input,rows,version:context.version};if(Buffer.byteLength(JSON.stringify(plan))>8*1024*1024)throw new PortalError(413,'نتيجة المعاينة كبيرة؛ قسّم الملف إلى دفعات أصغر');const stored=await importRpc('store_property_import_preview',{actor:user.id,plan});return json({...stored,rows});}catch(e){return apiError(e);}}
export const POST=withAudit(post);
