import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { adminClient, apiError, json, PortalError, requireIdentity } from '@/lib/portal/server';
import { locationSchema } from '@/lib/property-location';
import { inspectMedia, VIDEO_LIMIT } from '@/lib/property-media';

export const dynamic = 'force-dynamic';
const bucket = 'property-media';
type Params = { params: { id: string } };
async function readBody(req: NextRequest, limit: number) {
  const reader = req.body?.getReader();
  if (!reader) throw new PortalError(400,'طلب فارغ');
  const chunks:Uint8Array[] = [];let size=0;
  while (true) {
    const item=await reader.read();if(item.done)break;
    size+=item.value.length;
    if(size>limit){await reader.cancel();throw new PortalError(413,'تجاوز الملف الحجم المسموح');}
    chunks.push(item.value);
  }
  return Buffer.concat(chunks);
}
async function propertyAccess(req: NextRequest, id: string) {
  const identity = await requireIdentity(req);
  if (!['ADMIN','CEO','EMPLOYEE'].includes(identity.profile.account.role) || identity.profile.account.history_only) throw new PortalError(403, 'لا تملك صلاحية ملف العقار');
  if (!z.string().uuid().safeParse(id).success) throw new PortalError(404, 'العقار غير موجود');
  const { data, error } = await identity.client.from('properties').select('id,property_name,address,city,latitude,longitude,spreadsheet_details,ownership_document_id').eq('id',id).maybeSingle();
  if (error) throw new PortalError(503, 'تعذر تحميل العقار');
  if (!data) throw new PortalError(404, 'العقار غير موجود');
  return { ...identity, property: data };
}
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { property } = await propertyAccess(req,params.id);
    const admin = adminClient();
    const { data, error } = await admin.from('property_media').select('id,object_path,filename,mime_type,byte_size,created_at').eq('property_id',params.id).order('created_at',{ ascending:false });
    if (error) throw new PortalError(503, 'تعذر تحميل الصور والفيديو');
    const media = await Promise.all((data || []).map(async file => {
      const { data: link, error: signError } = await admin.storage.from(bucket).createSignedUrl(file.object_path,3600);
      if (signError || !link) return { ...file, object_path: undefined, url: null };
      // Storage may sign against the private internal endpoint. Return the public origin.
      const signed = new URL(link.signedUrl);
      const url = new URL(signed.pathname + signed.search,process.env.NEXT_PUBLIC_SUPABASE_URL).toString();
      return { ...file, object_path: undefined, url };
    }));
    return json({ property, media });
  } catch (error) { return apiError(error); }
}
async function PATCHHandler(req: NextRequest, { params }: Params) {
  try {
    const { client } = await propertyAccess(req,params.id);
    const input = (await readBody(req,512)).toString('utf8');
    let parsed: unknown; try { parsed = JSON.parse(input); } catch { throw new PortalError(400,'إحداثيات غير صالحة'); }
    const coordinates = locationSchema.strict().parse(parsed);
    const { data, error } = await client.from('properties').update(coordinates).eq('id',params.id).select('id').single();
    if (error || !data) throw new PortalError(403,'تعذر حفظ موقع العقار');
    return json({ saved:true });
  } catch (error) { return apiError(error); }
}
async function POSTHandler(req: NextRequest, { params }: Params) {
  try {
    const { user } = await propertyAccess(req,params.id);
    const type = (req.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(type)) throw new PortalError(400,'نوع ملف غير مدعوم');
    const bytes = await readBody(req,type.startsWith('image/') ? 10*1024*1024 : VIDEO_LIMIT);
    const detected = inspectMedia(type,bytes);
    if (!detected) throw new PortalError(400,'استخدم JPG أو PNG أو WebP حتى 10 MB، أو MP4 أو WebM حتى 40 MB');
    let filename: string;
    try { filename = decodeURIComponent(req.headers.get('x-file-name') || 'media'); } catch { throw new PortalError(400,'اسم ملف غير صالح'); }
    filename = filename.replace(/[\\/\u0000-\u001f\u007f]/g,'').trim().slice(0,150) || `media.${detected.ext}`;
    const id = crypto.randomUUID(), object_path = `${params.id}/${id}.${detected.ext}`, admin = adminClient();
    const storage = admin.storage.from(bucket);
    const { error } = await storage.upload(object_path,bytes,{ contentType:type,upsert:false });
    if (error) throw new PortalError(503,'تعذر رفع الملف. حاول مرة أخرى');
    const { error: insertError } = await admin.from('property_media').insert({ id,property_id:params.id,object_path,filename,mime_type:type,byte_size:bytes.length,uploaded_by:user.id });
    if (insertError) {
      const { error: cleanupError } = await storage.remove([object_path]);
      if (cleanupError) console.error('[property-media] Orphan cleanup required',id);
      throw new PortalError(503,'لم يتم حفظ الملف. حاول مرة أخرى');
    }
    return json({ saved:true,id });
  } catch (error) { return apiError(error); }
}
async function DELETEHandler(req: NextRequest, { params }: Params) {
  try {
    await propertyAccess(req,params.id);
    const id = z.string().uuid().parse(req.nextUrl.searchParams.get('media_id'));
    const admin = adminClient();
    const { data, error } = await admin.from('property_media').select('object_path').eq('id',id).eq('property_id',params.id).maybeSingle();
    if (error) throw new PortalError(503,'تعذر قراءة الملف');
    if (!data) throw new PortalError(404,'الملف غير موجود');
    const { error: storageError } = await admin.storage.from(bucket).remove([data.object_path]);
    if (storageError) throw new PortalError(503,'تعذر حذف الملف');
    const { error: deleteError } = await admin.from('property_media').delete().eq('id',id).eq('property_id',params.id);
    if (deleteError) throw new PortalError(503,'تعذر تحديث سجل الملف؛ أعد محاولة الحذف');
    return json({ deleted:true });
  } catch (error) { return apiError(error); }
}

export const PATCH=withAudit(PATCHHandler);

export const POST=withAudit(POSTHandler);

export const DELETE=withAudit(DELETEHandler);
