'use client';
import {useState,useEffect,useCallback,useRef} from 'react';
import type {Case,Unit} from '@/lib/operations/model';
import {operationsFetch} from '@/lib/operations/client';
type Reservation={case_id:string;unit_id:string;from:string;to:string;expires_at:string;extended:boolean;status:'ACTIVE'|'EXPIRED'|'CANCELLED'|'CONFIRMED'};
const states={ACTIVE:'حجز مؤقت',EXPIRED:'انتهت المهلة',CANCELLED:'ملغى',CONFIRMED:'تم تأكيد الطلب'};
export default function ReservationControls({cases,units,canManage,onChanged}:{cases:Case[];units:Unit[];canManage:boolean;onChanged:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [reservations,setReservations]=useState<Reservation[]|null>(null),[statusError,setStatusError]=useState(''),[serverNow,setServerNow]=useState('');
 const generation=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++generation.current;
  try{const response=await operationsFetch('/api/operations/reservations');const data=await response.json();
   if(!Array.isArray(data.reservations)||!Number.isFinite(Date.parse(data.server_now)))throw new Error('تعذر قراءة حالة الحجز');
   if(request===generation.current){setReservations(data.reservations);setServerNow(data.server_now);setStatusError('');}
  }catch(e){if(request===generation.current){setReservations(null);setStatusError(e instanceof Error?e.message:'تعذر قراءة حالة الحجوزات');}}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30000);return()=>{clearInterval(timer);generation.current++;};},[refresh]);
 async function send(body:Record<string,unknown>){
  setBusy(true);setError('');setMessage('');
  try{
   const response=await operationsFetch('/api/operations/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();
   setMessage(result.expires_at?'الحجز محفوظ حتى '+new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(new Date(result.expires_at))+' بتوقيت الرياض.':'تم إلغاء الحجز. العقد والتحصيلات لم تتغير.');
   onChanged();await refresh();
  }catch(e){setError(e instanceof Error?e.message:'تعذر تنفيذ الإجراء');}finally{setBusy(false);}
 }
 const caseSelect=<label className="block">طلب التأجير<select className="portal-input" name="case_id" required defaultValue=""><option value="" disabled>اختر الطلب</option>{cases.map(c=><option value={c.id} key={c.id}>{c.customer_name} · {c.need}</option>)}</select></label>;
 return <section className="portal-card space-y-4" aria-label="الحجز المؤقت">
  <h3 className="font-bold">الحجز المؤقت</h3>
  <p>سنوي: ٧٢ ساعة. شهري: ٢٤ ساعة. يومي: ساعتان للوصول اليوم أو غداً، و١٢ ساعة للمواعيد الأبعد. الحجز لا يؤكد العقد ولا يعتمد أي حركة مالية.</p>
  <form className="space-y-3" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void send({action:'reserve',case_id:d.get('case_id'),unit_id:d.get('unit_id'),from:d.get('from'),to:d.get('to')});}}>
   <fieldset disabled={busy} className="space-y-3">{caseSelect}
    <label className="block">الوحدة<select className="portal-input" name="unit_id" required defaultValue=""><option value="" disabled>اختر الوحدة</option>{units.map(u=><option value={u.id} key={u.id}>{u.property_name} · {u.code}</option>)}</select></label>
    <label className="block">الوصول<input className="portal-input" type="date" name="from" required /></label>
    <label className="block">المغادرة<input className="portal-input" type="date" name="to" required /></label>
    <button className="portal-button">تحقق واحجز مؤقتاً</button>
   </fieldset>
  </form>
  {canManage&&<details><summary>تمديد أو إلغاء حجز</summary>
   <p>التمديد مرة واحدة للحجز الشهري إلى ٧٢ ساعة من إنشائه. إلغاء الحجز لا ينهي عقداً قائماً ولا يسترد مبلغاً.</p>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void send({action:'extend',case_id:d.get('case_id'),reason:d.get('reason')});}}>
    <fieldset disabled={busy}>{caseSelect}<label>سبب التمديد<input className="portal-input" name="reason" required maxLength={1000}/></label><button className="portal-button">تمديد الحجز الشهري</button></fieldset>
   </form>
   <form className="space-y-3" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);void send({action:'cancel',case_id:d.get('case_id')});}}>
    <fieldset disabled={busy}>{caseSelect}<button className="portal-button">إلغاء الحجز المحدد</button></fieldset>
   </form>
  </details>}
  <div aria-live="polite"><h4>حالة الحجوزات المسجلة</h4>
   {statusError?<p role="alert">{statusError}</p>:reservations===null?<p>جارٍ تحميل الحالة…</p>:reservations.length===0?<p>لا توجد حجوزات مؤقتة ضمن صلاحياتك.</p>:reservations.map(r=><article className="border-t py-2" key={r.case_id}>
    <p>{cases.find(c=>c.id===r.case_id)?.customer_name||'طلب تأجير'} · {units.find(u=>u.id===r.unit_id)?.code||'وحدة'} — {states[r.status]}</p>
    <p>{r.from} إلى {r.to}</p>
    <p>المهلة: {new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(new Date(r.expires_at))} بتوقيت الرياض{r.extended?' · مُدد الحجز':''}</p>
    {r.status==='ACTIVE'&&<p>المتبقي عند آخر تحديث: {Math.max(0,Math.ceil((Date.parse(r.expires_at)-Date.parse(serverNow))/60000))} دقيقة</p>}
   </article>)}
   <p>تُحدّث الحالة كل ٣٠ ثانية؛ يعيد الخادم فحص التوفر عند تنفيذ أي حجز.</p><button type="button" className="ops-link" onClick={()=>void refresh()}>تحديث الحالة</button>
  </div>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
