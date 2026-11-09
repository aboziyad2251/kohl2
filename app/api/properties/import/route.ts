import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { adminClient,apiError,json,PortalError,requireIdentity } from '@/lib/portal/server';
import { importSchema } from '@/lib/property-import';
export const dynamic='force-dynamic';
async function POSTHandler(req:NextRequest){try{
 const {client,profile}=await requireIdentity(req);if(!['ADMIN','CEO','EMPLOYEE'].includes(profile.account.role)||profile.account.history_only)throw new PortalError(403,'لا تملك صلاحية استيراد العقارات');
 const reader=req.body?.getReader();if(!reader)throw new PortalError(400,'أرفق الجدول والصك');let length=0;const chunks:Uint8Array[]=[];
 while(true){const c=await reader.read();if(c.done)break;length+=c.value.length;if(length>12*1024*1024){await reader.cancel();throw new PortalError(413,'الحد الأقصى للصك 10 MB');}chunks.push(c.value);}
 let form:FormData;try{form=await new Response(Buffer.concat(chunks),{headers:{'content-type':req.headers.get('content-type')||''}}).formData();}catch{throw new PortalError(400,'طلب غير صالح');}
 let raw:unknown;try{raw=JSON.parse(String(form.get('payload')||''));}catch{throw new PortalError(400,'بيانات الاستيراد غير صالحة');}const payload=importSchema.parse(raw);
 const file=form.get('deed');if(!file||typeof file==='string'||!file.size||file.size>10*1024*1024)throw new PortalError(400,'أرفق الصك PDF أو صورة JPG/PNG حتى 10 MB');
 const bytes=Buffer.from(await file.arrayBuffer());const type=bytes.subarray(0,5).toString()==='%PDF-'?'pdf':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':null;
 if(!type)throw new PortalError(400,'ملف الصك يجب أن يكون PDF أو JPG أو PNG صالحاً');
 const hash=createHash('sha256').update(JSON.stringify(payload)).update(bytes).digest('hex');const path=`${payload.request_id}/${hash}.${type}`;
 const {data:owner,error:ownerError}=await client.from('lessors').select('id').eq('id',payload.lessor_id).maybeSingle();if(ownerError||!owner)throw new PortalError(403,'المالك غير متاح');
 const {data:prior,error:priorError}=await client.from('property_import_batches').select('id,fingerprint').eq('id',payload.request_id).maybeSingle();if(priorError)throw new PortalError(503,'تعذر التحقق من دفعة الاستيراد');
 const storage=adminClient().storage.from('ownership-deeds');let uploaded=false;
 if(prior){if(prior.fingerprint!==hash)throw new PortalError(409,'تغيّرت البيانات بعد الحفظ. أعد فتح الاستيراد لدفعة جديدة');}
 else{const {error}=await storage.upload(path,bytes,{contentType:type==='pdf'?'application/pdf':type==='png'?'image/png':'image/jpeg',upsert:false});if(error&&String(error.statusCode)!=='409')throw new PortalError(503,'تعذر رفع الصك. لم تُضف عقارات');uploaded=!error;}
 const {data,error}=await client.rpc('import_property_apartments',{payload,fingerprint:hash,object_path:path});
 if(error){
  // A failed transport may occur after commit. Never remove a deed until checked.
  const check=await client.from('property_import_batches').select('id').eq('id',payload.request_id).maybeSingle();
  if(uploaded&&!check.error&&!check.data)await storage.remove([path]);
  throw new PortalError(error.code==='23505'?409:503,error.code==='23505'?'تعارض في أرقام الوحدات. راجع السجل ثم أعد المحاولة':'تعذر تأكيد الحفظ. أعد المحاولة بنفس البيانات للتحقق دون تكرار العقارات');
 }
 if(uploaded&&data?.document_id){const linked=await client.from('ownership_documents').select('deed_object_path').eq('id',data.document_id).maybeSingle();if(!linked.error&&linked.data&&linked.data.deed_object_path!==path)await storage.remove([path]);}
 return json({saved:true,...data});
}catch(error){return apiError(error);}}

export const POST=withAudit(POSTHandler);
