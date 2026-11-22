'use client';
import { useRef,useState } from 'react';
import { operationsFetch } from '@/lib/operations/client';
import {suggestRequirements} from '@/lib/operations/availability';
import type { Unit } from '@/lib/operations/model';
type Row={id:string;code:string;available:boolean;reason:string;bedrooms:number|null;entrances:number|null};
const reasons:Record<string,string>={CONTRACT_STATUS_REVIEW:'حالة عقد مرتبطة بالعقار تحتاج مراجعة',HELD:'حجز مؤقت لم تنته مهلته',AVAILABLE:'متاحة خلال الفترة',CONTRACTED:'مرتبطة بعقد نشط',BOOKED:'محجوزة',NOT_READY:'غير جاهزة',CONTRACT_MAPPING_REQUIRED:'يلزم تحديد الوحدة في عقد قائم'};
export default function UnitAvailabilityPanel({units,contracts,canLink}:{units:Unit[];contracts:{id:string;contract_number:string}[];canLink:boolean}) {
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[rows,setRows]=useState<Row[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[all,setAll]=useState(false),[message,setMessage]=useState(''),[linking,setLinking]=useState(false);
 const [description,setDescription]=useState(''),[bedrooms,setBedrooms]=useState(''),[entrances,setEntrances]=useState(''),[unknown,setUnknown]=useState(0);
 const sequence=useRef(0);
 function invalidate(){sequence.current++;setRows(null);setUnknown(0);setError('');setBusy(false);}
 async function search(){
  const request=++sequence.current;setBusy(true);setError('');setRows(null);
  try {const response=await operationsFetch('/api/operations/availability?'+new URLSearchParams({from,to,bedrooms,entrances}));const data=await response.json();
   if(request===sequence.current){if(!Array.isArray(data.units))throw new Error('تعذر قراءة التوفر');setRows(data.units);setUnknown(data.unknown_specs_excluded||0);}
  }catch(e){if(request===sequence.current)setError(e instanceof Error?e.message:'تعذر البحث');}
  finally{if(request===sequence.current)setBusy(false);}
 }
 return <section className="portal-card space-y-4" aria-label="توفر الوحدات وربط العقود">
  <h3 className="font-bold">التوفر حسب فترة التأجير</h3>
  <p>نتائج التوفر تخص الفترة المحددة. العقد القائم غير المرتبط بوحدة يحتاج مراجعة قبل تأكيد الإتاحة.</p>
  <div className="space-y-2">
   <label className="block">وصف الشقة<input className="portal-input" maxLength={300} value={description} disabled={linking||busy} placeholder="شقة ٣ غرف مدخلين" onChange={e=>{invalidate();setDescription(e.target.value);setBedrooms('');setEntrances('');}}/></label>
   <button className="portal-button" type="button" disabled={linking||busy} onClick={()=>{const suggested=suggestRequirements(description);invalidate();setBedrooms(suggested.bedrooms?String(suggested.bedrooms):'');setEntrances(suggested.entrances?String(suggested.entrances):'');setMessage(Object.keys(suggested).length?'راجع الفلاتر المقترحة وعدّلها قبل البحث.':'لم أتعرف على عدد الغرف أو المداخل؛ حددهما في الفلاتر.');}}>اقتراح فلاتر من الوصف</button>
   <p>يطبق البحث الفترة والفلاتر الظاهرة فقط. الأوصاف الأخرى مثل الحي والسعر ليست فلاتر في هذه المرحلة.</p>
  </div>
  <form className="flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();void search();}}>
   <label>من<input className="portal-input" type="date" required disabled={linking} value={from} onChange={e=>{invalidate();setFrom(e.target.value);}} /></label>
   <label>إلى<input className="portal-input" type="date" required disabled={linking} value={to} onChange={e=>{invalidate();setTo(e.target.value);}} /></label>
   <label>عدد الغرف<input className="portal-input" type="number" min="1" max="100" step="1" disabled={linking} value={bedrooms} onChange={e=>{invalidate();setBedrooms(e.target.value);}} placeholder="أي عدد"/></label>
   <label>عدد المداخل<input className="portal-input" type="number" min="1" max="20" step="1" disabled={linking} value={entrances} onChange={e=>{invalidate();setEntrances(e.target.value);}} placeholder="أي عدد"/></label>
   <button className="portal-button" disabled={busy||linking}>{busy?'جارٍ التحقق…':'بحث التوفر'}</button>
  </form>
  <label className="flex gap-2"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)} />إظهار غير المتاح أيضاً</label>
  {error&&<p role="alert">{error}</p>}
  {rows!==null&&<div aria-live="polite">{rows.filter(row=>all||row.available).map(row=><p key={row.id}>{units.find(unit=>unit.id===row.id)?.property_name} · {row.code} — {reasons[row.reason]||'حالة تحتاج مراجعة'} · الغرف: {row.bedrooms??'غير مسجل'} · المداخل: {row.entrances??'غير مسجل'}</p>)}
   {!rows.some(row=>all||row.available)&&<p>لا توجد وحدات تطابق التوفر المحدد.</p>}</div>}
  {rows!==null&&unknown>0&&<p>استُبعدت {unknown} وحدة لعدم تسجيل المواصفات المطلوبة.</p>}
  {canLink&&<form className="space-y-3 border-t pt-4" onSubmit={async e=>{
   e.preventDefault();const form=e.currentTarget;const input=new FormData(form);setMessage('');invalidate();setLinking(true);
   try{await operationsFetch('/api/operations/availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contract_id:input.get('contract_id'),unit_id:input.get('unit_id')})});setMessage('تم ربط العقد بالوحدة. أعد البحث للتحقق من التوفر.');form.reset();}
   catch(e){setError(e instanceof Error?e.message:'تعذر الربط');}finally{setLinking(false);}
  }}>
   <h3 className="font-bold">تحديد الوحدة في العقد</h3><p>اختر الشقة المقصودة بعد مراجعة العقد. الربط لا يعدّل العقد أو التحصيلات، ولا يسمح باستبدال ربط سابق تلقائياً.</p>
   <label className="block">العقد<select required name="contract_id" className="portal-input" defaultValue=""><option value="" disabled>اختر العقد</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.contract_number}</option>)}</select></label>
   <label className="block">الشقة / الوحدة<select required name="unit_id" className="portal-input" defaultValue=""><option value="" disabled>اختر الوحدة</option>{units.map(u=><option key={u.id} value={u.id}>{u.property_name} · {u.code}</option>)}</select></label>
   <button className="portal-button" disabled={busy||linking}>حفظ ربط العقد بالوحدة</button>
  </form>}
  {canLink&&<details><summary>تسجيل مواصفات شقة</summary><p>أدخل مواصفات هذه الوحدة فقط. ترك الحقل فارغاً يعني أن المعلومة غير معروفة.</p>
   <form className="space-y-3" onSubmit={async e=>{
    e.preventDefault();const input=new FormData(e.currentTarget);setMessage('');invalidate();setLinking(true);
    const count=(key:string)=>input.get(key)===''?null:Number(input.get(key));
    try{await operationsFetch('/api/operations/availability',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({unit_id:input.get('unit_id'),bedrooms:count('bedrooms'),entrances:count('entrances')})});setMessage('تم حفظ مواصفات الوحدة. أعد البحث لعرض النتائج المحدثة.');}
    catch(e){setError(e instanceof Error?e.message:'تعذر الحفظ');}finally{setLinking(false);}
   }}><fieldset disabled={busy||linking} className="space-y-3">
    <label className="block">الوحدة<select className="portal-input" required name="unit_id" defaultValue=""><option value="" disabled>اختر الوحدة</option>{units.map(u=><option key={u.id} value={u.id}>{u.property_name} · {u.code}</option>)}</select></label>
    <label className="block">عدد الغرف<input className="portal-input" name="bedrooms" type="number" min="1" max="100" step="1"/></label>
    <label className="block">عدد المداخل<input className="portal-input" name="entrances" type="number" min="1" max="20" step="1"/></label>
    <button className="portal-button">حفظ مواصفات الوحدة</button>
   </fieldset></form>
  </details>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
