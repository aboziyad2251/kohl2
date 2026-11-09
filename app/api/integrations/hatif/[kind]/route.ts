import { withAudit } from '@/lib/audit/server';
import {NextRequest} from 'next/server';
import {adminClient} from '@/lib/portal/server';
import {HatifError,verifyHatif,parseHatif,normalizeHatifEvent} from '@/lib/integrations/hatif';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function POSTHandler(req:NextRequest,{params}:{params:{kind:string}}){try{
 if(!['calls','whatsapp'].includes(params.kind))return Response.json({error:'Not found'},{status:404});
 const secret=process.env.HATIF_WEBHOOK_SECRET;if(process.env.HATIF_ENABLED!=='true'||!secret||secret.length<20||secret.includes('•'))throw new HatifError(503,'ربط هاتف غير مفعّل');
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new HatifError(415,'JSON مطلوب');
 const reader=req.body?.getReader();if(!reader)throw new HatifError(400,'حدث فارغ');const chunks:Uint8Array[]=[];let size=0;
 while(true){const c=await reader.read();if(c.done)break;size+=c.value.length;if(size>512*1024){await reader.cancel();throw new HatifError(413,'الحدث أكبر من الحد المسموح');}chunks.push(c.value);}
 const raw=Buffer.concat(chunks);if(!verifyHatif(raw,req.headers.get('x-voxa-signature'),secret))throw new HatifError(401,'توقيع غير صالح');
 let body;try{body=JSON.parse(raw.toString('utf8'));}catch{throw new HatifError(400,'JSON غير صالح');}
 const p=parseHatif(params.kind,body);const event=await normalizeHatifEvent(params.kind,p);if(!event)return Response.json({received:true,ignored:true});
 const {data,error}=await adminClient().rpc('ingest_hatif_crm_event',{event});if(error)throw new HatifError(503,'تعذر حفظ الحدث؛ ستتم إعادة المحاولة');return Response.json({received:true,...data});
 }catch(e){return Response.json({error:e instanceof HatifError?e.message:'تعذر استقبال الحدث؛ أعد المحاولة'},{status:e instanceof HatifError?e.status:503});}}

export const POST=withAudit(POSTHandler);
