import { withAudit } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity, apiError, json, PortalError } from '@/lib/portal/server';
import { propertyPatchSchema } from '@/lib/properties/specifications';
async function PATCHHandler(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { client, profile } = await requireIdentity(req);
    if (!['ADMIN','CEO','EMPLOYEE'].includes(profile.account.role) || profile.account.history_only) throw new PortalError(403, 'لا تملك صلاحية تعديل العقار');
    const id = z.string().uuid().parse(params.id);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 16384) throw new PortalError(413, 'حجم الطلب كبير');
    let body: unknown; try { body = JSON.parse(raw); } catch { throw new PortalError(400, 'بيانات غير صالحة'); }
    const { title, ...values } = propertyPatchSchema.parse(body);
    const edited = Object.fromEntries(['rooms','lounges','bathrooms','entrances','price','unit_number','building_name'].filter(key => Object.prototype.hasOwnProperty.call(values,key)).map(key => [`${key}_edited`,true]));
    // User-token client retains the existing property RLS; no service-role write.
    const { data, error } = await client.from('properties').update({ ...values, ...edited, ...(title !== undefined ? { property_name: title } : {}) }).eq('id', id).select('*,title:property_name').maybeSingle();
    if (error) throw new PortalError(400, 'تعذر حفظ العقار. تحقق من البيانات والصلاحيات وتجهيز تحديث قاعدة البيانات.');
    if (!data) throw new PortalError(404, 'العقار غير موجود أو غير متاح للتعديل');
    return json({ property: data });
  } catch (error) { return apiError(error); }
}

export const PATCH=withAudit(PATCHHandler);
