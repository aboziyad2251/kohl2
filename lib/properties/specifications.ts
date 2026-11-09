import { amenitiesSchema } from './import-model';
import { z } from 'zod';
import type { Property } from '@/lib/types';
import { propertyKinds, propertyUses } from '@/lib/property-classification';
const count = z.number().int().min(0).max(100).nullable();
export const propertyPatchSchema = z.object({
  title: z.string().trim().min(3).max(255).optional(),
  property_type: z.enum(['Residential', 'Commercial', 'Land']).optional(),
  property_kind: z.enum(['LAND','APARTMENT','VILLA','FLOOR','BUILDING','SHOWROOM','SHOP','KIOSK','FOOD_TRUCK']).nullable().optional(),
  property_use: z.enum(['Residential','Commercial']).optional(),
  address: z.string().trim().min(3).max(1000).optional(), city: z.string().trim().min(2).max(150).optional(),
  region: z.string().trim().max(150).nullable().optional(), district: z.string().trim().max(150).nullable().optional(),
  units_count: z.number().int().min(1).max(100000).optional(),
  rooms: count.optional(), lounges: count.optional(), bathrooms: count.optional(), entrances: count.optional(),
  amenities: amenitiesSchema.optional(),
  property_code:z.string().trim().min(1).max(100).nullable().optional(), license_number:z.string().max(100).nullable().optional(),
  building_name:z.string().max(180).nullable().optional(),unit_number:z.string().max(60).nullable().optional(),notes:z.string().max(2000).nullable().optional(),
  price: z.number().finite().min(0).max(999999999999).nullable().optional(),
  media_url: z.string().trim().max(2048).url().refine(v => { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; }, 'استخدم رابط HTTPS صالحاً').nullable().optional(),
  lessor_id: z.string().uuid().optional(), current_representative_id: z.string().uuid().nullable().optional(),
}).strict().refine(v => Object.keys(v).length > 0);
export function specification(p: Property, field: 'rooms'|'lounges'|'bathrooms'|'entrances') {
  // Imported originals remain intact; each explicitly edited field can be cleared independently.
  return p[`${field}_edited`] ? p[field] ?? null : p[field] ?? p.spreadsheet_details?.[field === 'lounges' ? 'living_rooms' : field] ?? null;
}
export function propertyBadge(p: Property) {
  return `${propertyKinds.find(([v]) => v === p.property_kind)?.[1] || (p.property_type === 'Land' ? 'أرض' : 'غير محدد')} · ${propertyUses.find(([v]) => v === (p.property_use || p.property_type))?.[1] || 'غير محدد'}`;
}
export function propertyLocation(p: Property) { return [p.region, p.city, p.district || p.address].filter(v => v?.trim()).join(' - ') || '—'; }
export function safeMediaUrl(value: string | null | undefined) {
  try { const u = new URL(value || ''); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function displayValue(value: unknown) { return value === null || value === undefined || value === '' ? '—' : String(value); }

export function propertyPrice(p: Property): number | null {
  if (p.price_edited || p.price != null) return p.price ?? null;
  const raw = p.spreadsheet_details?.price_text?.trim().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/\s*(ر\.\s*س|ريال(?: سعودي)?|SAR)\s*$/i,'').trim();
  if (!raw || !/^(?:\d+|\d{1,3}(?:[,٬]\d{3})+)(?:[.٫]\d{1,2})?$/.test(raw)) return null;
  const value = Number(raw.replace(/[,٬]/g,'').replace('٫','.'));
  return Number.isFinite(value) && value <= 999999999999 ? value : null;
}
