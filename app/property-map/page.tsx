'use client';

import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import KohlPropertyMap from '@/components/map/KohlPropertyMap';
import MapEntryEditor from '@/components/map/MapEntryEditor';
import PropertyProfile from '@/components/ownership/PropertyProfile';
import { portalRequest } from '@/lib/portal/client';
import { MapEntry,MapPurpose,MapSource,entryKey,hasCoordinates,filterMapEntries,mapPurposes,purposeLabels } from '@/lib/property-map';
import { mapLinks } from '@/lib/property-location';
import type { Property } from '@/lib/types';

export default function PropertyMapPage(){
  const [entries,setEntries]=useState<MapEntry[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saved,setSaved]=useState(''),[updated,setUpdated]=useState('');
  const [search,setSearch]=useState(''),[purpose,setPurpose]=useState<'ALL'|'UNCLASSIFIED'|MapPurpose>('ALL'),[source,setSource]=useState<'ALL'|MapSource>('ALL'),[location,setLocation]=useState<'ALL'|'LOCATED'|'MISSING'>('ALL'),[includeHidden,setIncludeHidden]=useState(false);
  const [selected,setSelected]=useState<string|null>(null),[editor,setEditor]=useState<MapEntry|null>(null),[media,setMedia]=useState<MapEntry|null>(null),[fitRequest,setFitRequest]=useState(0);
  const [selectionRequest,setSelectionRequest]=useState(0);
  const requestedEntryHandled=useRef(false);
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{const data=await portalRequest<{entries:MapEntry[];updated_at:string}>('/api/property-map');setEntries(data.entries);setUpdated(data.updated_at);}
    catch(err){setError(err instanceof Error?err.message:'تعذر تحميل الخريطة');setEntries([]);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{if(!entries.length||requestedEntryHandled.current)return;requestedEntryHandled.current=true;const wanted=new URL(window.location.href).searchParams.get('entry');if(wanted){const entry=entries.find(item=>entryKey(item)===wanted);if(entry){setSelected(wanted);setEditor(entry);}}},[entries]);
  const filtered=useMemo(()=>filterMapEntries(entries,{search,purpose,source,location,includeHidden}),[entries,search,purpose,source,location,includeHidden]);
  const pins=useMemo(()=>filtered.filter(entry=>entry.map_visible&&hasCoordinates(entry)),[filtered]);
  const visibleEntries=entries.filter(entry=>entry.map_visible),missing=visibleEntries.filter(entry=>!hasCoordinates(entry)).length;
  useEffect(()=>{if(selected&&!filtered.some(entry=>entryKey(entry)===selected))setSelected(null);},[filtered,selected]);
  const profile=media?{id:media.id,title:media.title,city:media.city,address:media.address,units_count:media.units_count,lessor_id:'',property_type:media.property_type==='Commercial'?'Commercial':media.property_type==='Land'?'Land':'Residential'} as Property:null;
  return <div className="kohl-map-page">
    <div className="map-page-heading"><div><p className="map-eyebrow">محفظة المكتب على الخريطة</p><h1>خريطة كحل العقارية</h1><p className="map-muted">كل عقار نديره أو نعرضه للتأجير أو البيع، في رؤية واحدة.</p></div><div className="map-heading-actions"><button type="button" disabled={loading} onClick={()=>void refresh()}>{loading?'جارٍ التحديث…':'تحديث العقارات'}</button><Link href="/ownership-properties" className="map-primary">سجل العقارات ↗</Link></div></div>
    <div className="map-stat-row"><div><strong>{visibleEntries.filter(hasCoordinates).length}</strong><span>عقار محدد على الخريطة</span></div><button onClick={()=>setLocation('MISSING')}><strong>{missing}</strong><span>بدون موقع · استكمال الإحداثيات</span></button><button onClick={()=>setIncludeHidden(value=>!value)}><strong>{entries.filter(entry=>!entry.map_visible).length}</strong><span>عقارات مخفية من الخريطة</span></button></div>
    {error&&<p role="alert" className="map-form-error">{error}</p>}{saved&&<p role="status" className="map-save-notice">{saved}</p>}
    <section className="map-filter-panel" aria-label="تصفية عقارات الخريطة"><label className="map-search">بحث عن عقار<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="اسم العقار، المدينة أو العنوان"/></label><label>السجل<select aria-label="السجل" value={source} onChange={e=>setSource(e.target.value as typeof source)}><option value="ALL">جميع السجلات</option><option value="PROPERTY">سجل العقارات</option><option value="MANAGED">عقود إدارة الأملاك</option></select></label><label>الموقع<select aria-label="الموقع" value={location} onChange={e=>setLocation(e.target.value as typeof location)}><option value="ALL">جميع المواقع</option><option value="LOCATED">محدد الموقع</option><option value="MISSING">بدون موقع</option></select></label><label className="map-hidden-toggle"><input type="checkbox" checked={includeHidden} onChange={e=>setIncludeHidden(e.target.checked)}/>إظهار المخفية في القائمة</label>
      <div className="map-purpose-tabs" aria-label="الغرض من العقار"><button aria-pressed={purpose==='ALL'} onClick={()=>setPurpose('ALL')}>الكل</button>{mapPurposes.map(p=><button key={p} aria-pressed={purpose===p} onClick={()=>setPurpose(p)}><i className={`purpose-dot dot-${p.toLowerCase()}`}/>{purposeLabels[p]}</button>)}<button aria-pressed={purpose==='UNCLASSIFIED'} onClick={()=>setPurpose('UNCLASSIFIED')}>غير مصنف</button></div>
    </section>
    <div className="map-main-grid"><section className="map-board" aria-label="الخريطة التفاعلية"><div className="map-board-heading"><span>{pins.length} عقار على الخريطة</span><button type="button" onClick={()=>setFitRequest(value=>value+1)}>عرض جميع العلامات</button></div><KohlPropertyMap entries={pins} selected={selected} onOpen={setEditor} fitRequest={fitRequest} selectionRequest={selectionRequest}/><div className="map-legend"><span><i className="purpose-dot dot-management"/>إدارة</span><span><i className="purpose-dot dot-rent"/>إيجار</span><span><i className="purpose-dot dot-sale"/>بيع</span><span><i className="purpose-dot dot-other"/>غير مصنف</span></div><p className="map-muted map-footnote">خريطة داخلية للمكتب. اضغط على المجموعة لتقريب العقارات، أو اختر عقاراً من القائمة.</p></section>
      <section className="map-property-list" aria-label="قائمة عقارات الخريطة"><div className="map-list-heading"><h2>العقارات</h2><span>{filtered.length} نتيجة</span></div>{loading&&<p role="status" className="map-empty">جارٍ تحميل العقارات…</p>}{!loading&&!filtered.length&&<p className="map-empty">لا توجد عقارات مطابقة. غيّر عوامل التصفية أو أضف عقاراً إلى السجل.</p>}
        {filtered.map(entry=><article key={entryKey(entry)} className={`map-property-card ${selected===entryKey(entry)?'is-selected':''}`}><p className="map-entry-source">{entry.source==='MANAGED'?'عقد إدارة أملاك':'سجل العقارات'}</p><button className="map-entry-title" onClick={()=>{if(hasCoordinates(entry)&&entry.map_visible){setSelected(entryKey(entry));setSelectionRequest(value=>value+1);}else setEditor(entry);}}>{entry.title}</button><p className="map-muted">{[entry.city,entry.address].filter(Boolean).join(' · ')||'العنوان غير مكتمل'}</p><div className="map-entry-tags">{entry.map_purposes.length?entry.map_purposes.map(p=><span key={p} className={`purpose-tag tag-${p.toLowerCase()}`}>{purposeLabels[p]}</span>):<span className="purpose-tag">غير مصنف</span>}{!entry.map_visible&&<span className="purpose-tag">مخفي</span>}{!hasCoordinates(entry)&&<span className="purpose-tag tag-missing">بدون موقع</span>}</div><div className="map-card-actions"><button onClick={()=>setEditor(entry)}>{hasCoordinates(entry)?'ملف العقار':'إضافة الموقع'}</button>{hasCoordinates(entry)&&<a href={mapLinks({latitude:entry.latitude!,longitude:entry.longitude!}).directions} target="_blank" rel="noopener noreferrer">اتجاهات ↗</a>}</div></article>)}
      </section></div>
    {updated&&<p className="map-muted">آخر تحديث: {new Date(updated).toLocaleTimeString('ar-SA',{timeZone:'Asia/Riyadh'})}</p>}
    {editor&&<MapEntryEditor key={entryKey(editor)} entry={editor} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setSaved('تم حفظ بيانات الخريطة');void refresh();}} onMedia={()=>{setEditor(null);setMedia(editor);}}/>}
    {profile&&<PropertyProfile key={profile.id} property={profile} onClose={()=>{setMedia(null);void refresh();}}/>}
  </div>;
}
