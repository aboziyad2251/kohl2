'use client';
import React, { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDraftForm } from '@/lib/drafts/hooks';
import { propertyKinds, propertyUses } from '@/lib/property-classification';
import { propertyPatchSchema, specification, propertyPrice } from '@/lib/properties/specifications';
import type { Property, Lessor, Representative } from '@/lib/types';
const schema = propertyPatchSchema;
type Input = z.infer<typeof schema>;
export default function EditPropertyModal({ isOpen, onClose, property, onSuccess }: {
  isOpen: boolean; onClose: () => void; property: Property | null; lessors: Lessor[]; representatives: Representative[]; onSuccess: (property: Property) => void | Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const { register, handleSubmit, reset, clearDraft, formState: { errors } } = useDraftForm<Input>('EditPropertyModal:' + (property?.id || 'none'), { resolver: zodResolver(schema) }, isOpen && !!property);
  useEffect(() => {
    if (!isOpen || !property) return;
    setError('');
    reset({ title: property.title, property_type: property.property_type, property_kind: property.property_kind || null, property_use: property.property_use || (property.property_type === 'Commercial' ? 'Commercial' : 'Residential'), address: property.address, city: property.city, region: property.region ?? '', district: property.district ?? '', units_count: property.units_count,
      rooms: specification(property,'rooms'), lounges: specification(property,'lounges'), bathrooms: specification(property,'bathrooms'), entrances: specification(property,'entrances'), price: propertyPrice(property), media_url: property.media_url ?? null });
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, [isOpen, property, reset]);
  if (!isOpen || !property) return null;
  async function save(input: Input) {
    setBusy(true); setError('');
    try { const use = input.property_use; await onSuccess({ ...property!, ...input, ...Object.fromEntries(['rooms','lounges','bathrooms','entrances','price'].map(key=>[`${key}_edited`,true])), property_type: input.property_kind === 'LAND' ? 'Land' : use || property!.property_type } as Property); clearDraft(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر حفظ العقار'); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="kr-modal portal-surface" aria-labelledby="edit-property-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} dir="rtl">
    <div className="flex justify-between gap-3"><h2 id="edit-property-title" className="text-xl font-bold">تعديل العقار</h2><button type="button" onClick={onClose} disabled={busy} aria-label="إغلاق تعديل العقار">إغلاق ×</button></div>
    <form onSubmit={handleSubmit(save)} className="space-y-4 mt-4">
      {error && <p role="alert" className="text-red-500">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label>اسم العقار<input className="portal-input" {...register('title')} /></label>
        <label>نوع العقار<select className="portal-input" {...register('property_kind', { setValueAs: v => v || null })}><option value="">غير محدد</option>{propertyKinds.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>التصنيف<select className="portal-input" {...register('property_use')}>{propertyUses.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>عدد الوحدات<input className="portal-input" type="number" min="1" {...register('units_count', { valueAsNumber: true })} /></label>
        {([['rooms','عدد الغرف'],['lounges','عدد الصالات'],['bathrooms','عدد الحمامات'],['entrances','عدد المداخل'],['price','السعر']] as const).map(([key,label]) => <label key={key}>{label}<input className="portal-input" type="number" min="0" step={key === 'price' ? '0.01' : '1'} {...register(key, { setValueAs: v => v === '' || v === null || v === undefined ? null : Number(v) })} /></label>)}
        {([['region','المنطقة'],['city','المدينة'],['district','الحي'],['address','العنوان']] as const).map(([key,label]) => <label key={key}>{label}<input className="portal-input" {...register(key)} /></label>)}
      </div>
      <label className="block">ملف العقار · الموقع والصور والفيديو (رابط HTTPS اختياري)<input className="portal-input" type="url" dir="ltr" {...register('media_url', { setValueAs: v => v === '' ? null : v })} /></label>
      <p className="text-sm">المالك: {property.lessor?.name || '—'} · الممثل: {property.current_representative?.name || 'لا يوجد وكيل'}. لتغييرهما استخدم إجراء نقل الملكية أو تغيير الوكيل لضمان سجل التدقيق.</p>
      {Object.keys(errors).length > 0 && <p role="alert" className="text-red-500">راجع البيانات: {Object.entries(errors).map(([key,value]) => ({ title:'اسم العقار',property_kind:'نوع العقار',property_type:'تصنيف العقار',property_use:'استخدام العقار',units_count:'عدد الوحدات',rooms:'الغرف',lounges:'الصالات',bathrooms:'الحمامات',entrances:'المداخل',price:'السعر',city:'المدينة',address:'العنوان',media_url:'رابط ملف العقار',region:'المنطقة',district:'الحي' } as Record<string,string>)[key] || 'أحد الحقول').join(' · ')}</p>}
      <div className="flex gap-3"><button className="portal-button" disabled={busy} type="submit">{busy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</button><button type="button" disabled={busy} onClick={onClose}>إلغاء</button></div>
    </form>
  </dialog>;
}
