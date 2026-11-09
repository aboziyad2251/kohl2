'use client';

import Link from 'next/link';
import PropertySpecifications from './PropertySpecifications';
import DeedAttachment from './DeedAttachment';
import React, { useEffect, useRef, useState } from 'react';
import { Property } from '@/lib/types';
import { mapLinks, parseCoordinates, locationSchema } from '@/lib/property-location';
import { PHOTO_LIMIT, VIDEO_LIMIT, mediaTypes } from '@/lib/property-media';
import { portalRequest } from '@/lib/portal/client';
import { supabase } from '@/lib/supabaseClient';

type Media = { id:string; filename:string; mime_type:string; url:string|null };
type Profile = { property:{ latitude:number|null; longitude:number|null; spreadsheet_details?:Property['spreadsheet_details'];ownership_document_id?:string }; media:Media[] };

export default function PropertyProfile({ property, onClose, onEdit }: { property:Property; onClose:()=>void; onEdit?:()=>void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;element?.showModal();return ()=>element?.close();},[]);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [lat,setLat] = useState(''), [lng,setLng] = useState(''), [paste,setPaste] = useState('');
  const [busy,setBusy] = useState(false), [loading,setLoading] = useState(true), [error,setError] = useState(''), [message,setMessage] = useState('');
  const [deleting,setDeleting] = useState<string|null>(null);
  const endpoint = `/api/properties/${property.id}/profile`;
  async function load() {
    const data = await portalRequest<Profile>(endpoint);
    setProfile(data);setLat(data.property.latitude == null ? '' : String(data.property.latitude));setLng(data.property.longitude == null ? '' : String(data.property.longitude));
  }
  useEffect(() => { let active = true;
    portalRequest<Profile>(endpoint).then(data => { if (active) { setProfile(data);setLat(data.property.latitude == null ? '' : String(data.property.latitude));setLng(data.property.longitude == null ? '' : String(data.property.longitude)); } }).catch(err=>active&&setError(err.message)).finally(()=>active&&setLoading(false));
    return ()=>{ active=false; };
  },[endpoint]);
  const location = profile?.property.latitude != null && profile?.property.longitude != null ? locationSchema.safeParse(profile.property) : null;
  const links = location?.success ? mapLinks(location.data) : null;
  async function saveLocation(event:React.FormEvent) {
    event.preventDefault();setError('');setMessage('');
    const parsed = lat.trim() && lng.trim() && locationSchema.safeParse({ latitude:Number(lat),longitude:Number(lng) });
    if (!parsed || !parsed.success) { setError('أدخل خط عرض من ‎-90 إلى 90 وخط طول من ‎-180 إلى 180');return; }
    setBusy(true);
    try { await portalRequest(endpoint,{ method:'PATCH',body:JSON.stringify(parsed.data) });await load();setMessage('تم حفظ موقع العقار'); }
    catch(err) { setError(err instanceof Error ? err.message : 'تعذر حفظ الموقع'); }finally{setBusy(false);}
  }
  function applyCoordinates() {
    const parsed = parseCoordinates(paste);
    if (!parsed) { setError('الصق إحداثيات مثل 24.7136,46.6753 أو رابط Google Maps الكامل. افتح الرابط المختصر وانسخ الإحداثيات من الدبوس');return; }
    setLat(String(parsed.latitude));setLng(String(parsed.longitude));setError('');setMessage('راجع الإحداثيات ثم احفظ الموقع');
  }
  async function upload(file?:File) {
    if (!file) return;setError('');setMessage('');
    if (!(mediaTypes as readonly string[]).includes(file.type) || !file.size || file.size > (file.type.startsWith('image/') ? PHOTO_LIMIT : VIDEO_LIMIT)) { setError('صور JPG/PNG/WebP حتى 10 MB، وفيديو MP4/WebM حتى 40 MB');return; }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error('يرجى تسجيل الدخول');
      const response = await fetch(endpoint,{ method:'POST',headers:{ Authorization:`Bearer ${data.session.access_token}`,'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name) },body:file });
      const body = await response.json();if (!response.ok) throw new Error(body.error || 'تعذر رفع الملف');
      await load();setMessage('تمت إضافة الملف إلى ملف العقار');
    } catch(err) { setError(err instanceof Error ? err.message : 'تعذر رفع الملف'); }finally{setBusy(false);}
  }
  async function deleteMedia(id:string) {
    setBusy(true);setError('');setMessage('');
    try { await portalRequest(`${endpoint}?media_id=${encodeURIComponent(id)}`,{ method:'DELETE' });setDeleting(null);await load();setMessage('تم حذف الملف'); }
    catch(err) { setError(err instanceof Error ? err.message : 'تعذر حذف الملف'); }finally{setBusy(false);}
  }
  return <dialog ref={dialog} onCancel={event=>{event.preventDefault();if(!busy)onClose();}} className="fixed inset-0 z-50 bg-black/70 p-3 sm:p-6 overflow-y-auto text-inherit" style={{width:'100%',height:'100%',maxWidth:'none',maxHeight:'none',margin:0}} aria-label={`ملف العقار: ${property.title}`}>
    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold text-white">{property.title}</h2><p className="text-sm text-slate-400">{property.city} · {property.address}</p></div><button type="button" disabled={busy} onClick={onClose} aria-label="إغلاق ملف العقار" className="px-3 py-2 border border-slate-700 rounded-lg">إغلاق ×</button></div>
      {onEdit && <button className="portal-button" type="button" disabled={busy} onClick={onEdit}>تعديل العقار</button>}<PropertySpecifications property={property} />
      {error && <p role="alert" className="text-red-400">{error}</p>}{message && <p role="status" className="text-emerald-400">{message}</p>}
      {loading ? <p role="status">جارٍ تحميل ملف العقار…</p> : <>
      {profile?.property.spreadsheet_details&&<section className="space-y-3 border border-slate-700 rounded-xl p-4"><h3 className="font-bold">بيانات الشقة من Excel</h3><dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">{([['apartment_number','رقم الشقة'],['rooms','الغرف'],['living_rooms','الصالات'],['bathrooms','الحمامات'],['entrances','المداخل'],['master_rooms','غرف الماستر'],['maid_rooms','غرف الخادمة'],['price_text','السعر كما ورد'],['notes','ملاحظات']] as const).map(([key,label])=><div key={key}><dt className="text-xs text-slate-400">{label}</dt><dd>{profile.property.spreadsheet_details?.[key]??'—'}</dd></div>)}</dl><p className="text-xs text-slate-400">{profile.property.spreadsheet_details.source_name} · {profile.property.spreadsheet_details.sheet_name} · الصف {profile.property.spreadsheet_details.source_row}</p>{profile.property.ownership_document_id&&<DeedAttachment id={profile.property.ownership_document_id}/>}</section>}
      <section className="space-y-4"><div className="flex flex-wrap justify-between items-center gap-3"><h3 className="font-bold">الموقع على الخريطة</h3><Link href={`/property-map?entry=PROPERTY:${property.id}`} className="text-sm underline">تصنيف العقار في خريطة كحل ↗</Link></div>
        {links ? <><iframe title={`موقع ${property.title} على Google Maps`} src={links.embed} width="100%" height="340" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen className="rounded-xl border border-slate-700" /><div className="flex flex-wrap gap-3 text-sm"><a href={links.view} target="_blank" rel="noopener noreferrer" className="portal-button">فتح في Google Maps ↗</a><a href={links.directions} target="_blank" rel="noopener noreferrer" className="portal-button">الاتجاهات إلى العقار ↗</a></div></> : <p className="p-5 border border-slate-700 rounded-xl text-amber-400">لم يُحدد موقع العقار بعد. أضف دبوس GPS دقيقاً لتتمكن من التعرف عليه.</p>}
        <form onSubmit={saveLocation} className="space-y-3">
          <label className="block text-sm">إحداثيات أو رابط Google Maps كامل<div className="flex gap-2 mt-2"><input value={paste} onChange={e=>setPaste(e.target.value)} placeholder="24.7136,46.6753" className="portal-input min-w-0" dir="ltr" disabled={busy} /><button type="button" onClick={applyCoordinates} className="portal-button shrink-0" disabled={busy}>استخراج</button></div></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm">خط العرض Latitude<input type="number" step="any" min="-90" max="90" required value={lat} onChange={e=>setLat(e.target.value)} className="portal-input" dir="ltr" disabled={busy} /></label><label className="text-sm">خط الطول Longitude<input type="number" step="any" min="-180" max="180" required value={lng} onChange={e=>setLng(e.target.value)} className="portal-input" dir="ltr" disabled={busy} /></label></div>
          <button type="submit" className="portal-button" disabled={busy || !profile}>حفظ موقع العقار</button>
          <p className="text-xs text-slate-400">في Google Maps اضغط مطولاً على موقع العقار ثم انسخ إحداثيات الدبوس. لا تُستخدم إحداثيات موقع جهازك تلقائياً.</p>
        </form>
      </section>
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">صور وفيديو العقار</h3><button type="button" disabled={busy || !profile} onClick={()=>{setBusy(true);load().catch(err=>setError(err.message)).finally(()=>setBusy(false));}} className="text-sm underline">تحديث المعرض</button></div>
        <label className="block text-sm">إضافة صورة أو فيديو<input type="file" accept={mediaTypes.join(',')} disabled={busy || !profile} className="block mt-2 max-w-full" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file);}} /></label><p className="text-xs text-slate-400">JPG / PNG / WebP: حتى 10 MB · MP4 / WebM: حتى 40 MB. الملفات خاصة بالمستخدمين المصرح لهم.</p>
        {busy && <p role="status">جارٍ الحفظ… يرجى الانتظار</p>}
        {profile?.media.length === 0 && <p className="text-slate-400">لا توجد صور أو فيديو لهذا العقار بعد.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{profile?.media.map(file=><article key={file.id} className="border border-slate-700 rounded-xl overflow-hidden">
          {file.url ? file.mime_type.startsWith('image/') ? <img src={file.url} alt={file.filename} className="w-full h-48 object-cover" loading="lazy" /> : <video src={file.url} controls preload="metadata" className="w-full h-48 object-contain bg-black" /> : <p className="p-4">الملف غير متاح حالياً</p>}
          <div className="p-3 space-y-2"><p className="text-xs break-all">{file.filename}</p>{deleting === file.id ? <div className="flex gap-3 text-sm"><button type="button" disabled={busy} onClick={()=>void deleteMedia(file.id)} className="text-red-400">تأكيد الحذف</button><button type="button" disabled={busy} onClick={()=>setDeleting(null)}>إلغاء</button></div> : <button type="button" disabled={busy} onClick={()=>setDeleting(file.id)} className="text-sm text-red-400">حذف الملف</button>}</div>
        </article>)}</div>
      </section></>}
    </div>
  </dialog>;
}
