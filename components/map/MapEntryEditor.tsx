'use client';

import React,{useEffect,useRef,useState} from 'react';
import { MapEntry,MapPurpose,mapPurposes,purposeLabels,mapUpdateSchema,managedMapUpdateSchema,hasCoordinates } from '@/lib/property-map';
import { parseCoordinates,mapLinks } from '@/lib/property-location';
import { portalRequest } from '@/lib/portal/client';

export default function MapEntryEditor({entry,onClose,onSaved,onMedia}:{entry:MapEntry;onClose:()=>void;onSaved:()=>void;onMedia:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [lat,setLat]=useState(entry.latitude==null?'':String(entry.latitude)),[lng,setLng]=useState(entry.longitude==null?'':String(entry.longitude)),[paste,setPaste]=useState('');
  const [city,setCity]=useState(entry.city),[address,setAddress]=useState(entry.address),[purposes,setPurposes]=useState<MapPurpose[]>(entry.map_purposes),[visible,setVisible]=useState(entry.map_visible);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  function extract(){const coordinates=parseCoordinates(paste);if(!coordinates){setError('الصق الإحداثيات أو رابط Google Maps الكامل، وليس الرابط المختصر');return;}setLat(String(coordinates.latitude));setLng(String(coordinates.longitude));setError('');}
  async function save(event:React.FormEvent){
    event.preventDefault();setError('');
    const input={latitude:lat.trim()?Number(lat):null,longitude:lng.trim()?Number(lng):null,map_purposes:purposes,map_visible:visible,...(entry.source==='MANAGED'?{city,address}:{})};
    const parsed=(entry.source==='MANAGED'?managedMapUpdateSchema:mapUpdateSchema).safeParse(input);
    if(!parsed.success){setError('راجع الإحداثيات: أدخل خط عرض وخط طول صالحين معاً، أو اترك الحقلين فارغين');return;}
    setBusy(true);
    try{await portalRequest(`/api/property-map/${entry.source}/${entry.id}`,{method:'PATCH',body:JSON.stringify(parsed.data)});onSaved();}
    catch(err){setError(err instanceof Error?err.message:'تعذر حفظ العقار');}finally{setBusy(false);}
  }
  return <dialog ref={dialog} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-label={`ملف خريطة العقار: ${entry.title}`} className="map-editor-dialog">
    <div className="map-editor-panel"><div className="map-editor-heading"><div><p className="map-eyebrow">{entry.source==='MANAGED'?'سجل عقود إدارة الأملاك':'سجل العقارات'}</p><h2>{entry.title}</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="إغلاق ملف الخريطة">إغلاق ×</button></div>
      {error&&<p role="alert" className="map-form-error">{error}</p>}
      <form onSubmit={save} className="map-editor-form">
        <fieldset><legend>غرض العقار</legend><p className="map-muted">يمكن اختيار أكثر من غرض للعقار نفسه.</p><div className="map-purpose-options">{mapPurposes.map(p=><label key={p}><input type="checkbox" checked={purposes.includes(p)} disabled={busy} onChange={e=>setPurposes(current=>e.target.checked?[...current,p]:current.filter(value=>value!==p))}/>{purposeLabels[p]}</label>)}</div></fieldset>
        <label className="map-visibility-option"><input type="checkbox" checked={visible} disabled={busy} onChange={e=>setVisible(e.target.checked)}/>إظهار في خريطة كحل الداخلية</label>
        {entry.source==='MANAGED'?<div className="map-coordinate-grid"><label>المدينة<input value={city} onChange={e=>setCity(e.target.value)} maxLength={100} disabled={busy}/></label><label>العنوان<input value={address} onChange={e=>setAddress(e.target.value)} maxLength={1000} disabled={busy}/></label></div>:<p className="map-muted">{entry.city} · {entry.address}</p>}
        <label>إحداثيات أو رابط Google Maps كامل<div className="map-import-row"><input value={paste} onChange={e=>setPaste(e.target.value)} placeholder="24.7136,46.6753" dir="ltr" disabled={busy}/><button type="button" onClick={extract} disabled={busy}>استخراج</button></div></label>
        <div className="map-coordinate-grid"><label>خط العرض Latitude<input type="number" step="any" min="-90" max="90" value={lat} onChange={e=>setLat(e.target.value)} dir="ltr" disabled={busy}/></label><label>خط الطول Longitude<input type="number" step="any" min="-180" max="180" value={lng} onChange={e=>setLng(e.target.value)} dir="ltr" disabled={busy}/></label></div>
        <p className="map-muted">العقار دون إحداثيات يبقى ضمن قائمة «بدون موقع» ولا توضع له علامة تخمينية.</p>
        <div className="map-editor-actions"><button className="map-primary" type="submit" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ بيانات الخريطة'}</button>{entry.source==='PROPERTY'&&<button type="button" disabled={busy} onClick={onMedia}>الصور والفيديو وملف العقار</button>}{hasCoordinates(entry)&&<a href={mapLinks({latitude:entry.latitude!,longitude:entry.longitude!}).directions} target="_blank" rel="noopener noreferrer">اتجاهات Google Maps ↗</a>}</div>
      </form>
    </div>
  </dialog>;
}
