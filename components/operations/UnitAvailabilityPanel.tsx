'use client';
import { useRef,useState } from 'react';
import { operationsFetch } from '@/lib/operations/client';
import type { Unit } from '@/lib/operations/model';
type Row={id:string;code:string;available:boolean;reason:string};
const reasons:Record<string,string>={AVAILABLE:'متاحة خلال الفترة',CONTRACTED:'مرتبطة بعقد نشط',BOOKED:'محجوزة',NOT_READY:'غير جاهزة',CONTRACT_MAPPING_REQUIRED:'يلزم تحديد الوحدة في عقد قائم'};
export default function UnitAvailabilityPanel({units,contracts,canLink}:{units:Unit[];contracts:{id:string;contract_number:string}[];canLink:boolean}) {
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[rows,setRows]=useState<Row[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[all,setAll]=useState(false),[message,setMessage]=useState(''),[linking,setLinking]=useState(false);
 const sequence=useRef(0);
 function invalidate(){sequence.current++;setRows(null);setError('');setBusy(false);}
 async function search(){
  const request=++sequence.current;setBusy(true);setError('');setRows(null);
  try {const response=await operationsFetch('/api/operations/availability?'+new URLSearchParams({from,to}));const data=await response.json();
   if(request===sequence.current){if(!Array.isArray(data.units))throw new Error('تعذر قراءة التوفر');setRows(data.units);}
  }catch(e){if(request===sequence.current)setError(e instanceof Error?e.message:'تعذر البحث');}
  finally{if(request===sequence.current)setBusy(false);}
 }
 return <section className="portal-card space-y-4" aria-label="توفر الوحدات وربط العقود">
  <h3 className="font-bold">التوفر حسب فترة التأجير</h3>
  <p>نتائج التوفر تخص الفترة المحددة. العقد القائم غير المرتبط بوحدة يحتاج مراجعة قبل تأكيد الإتاحة.</p>
  <form className="flex flex-wrap gap-3 items-end" onSubmit={e=>{e.preventDefault();void search();}}>
   <label>من<input className="portal-input" type="date" required disabled={linking} value={from} onChange={e=>{invalidate();setFrom(e.target.value);}} /></label>
   <label>إلى<input className="portal-input" type="date" required disabled={linking} value={to} onChange={e=>{invalidate();setTo(e.target.value);}} /></label>
   <button className="portal-button" disabled={busy||linking}>{busy?'جارٍ التحقق…':'بحث التوفر'}</button>
  </form>
  <label className="flex gap-2"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)} />إظهار غير المتاح أيضاً</label>
  {error&&<p role="alert">{error}</p>}
  {rows!==null&&<div aria-live="polite">{rows.filter(row=>all||row.available).map(row=><p key={row.id}>{units.find(unit=>unit.id===row.id)?.property_name} · {row.code} — {reasons[row.reason]||'حالة تحتاج مراجعة'}</p>)}
   {!rows.some(row=>all||row.available)&&<p>لا توجد وحدات تطابق التوفر المحدد.</p>}</div>}
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
  {message&&<p role="status">{message}</p>}
 </section>;
}
