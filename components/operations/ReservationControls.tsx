'use client';
import {useState} from 'react';
import type {Case,Unit} from '@/lib/operations/model';
import {operationsFetch} from '@/lib/operations/client';
export default function ReservationControls({cases,units,canManage,onChanged}:{cases:Case[];units:Unit[];canManage:boolean;onChanged:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function send(body:Record<string,unknown>){
  setBusy(true);setError('');setMessage('');
  try{
   const response=await operationsFetch('/api/operations/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json();
   setMessage(result.expires_at?'الحجز محفوظ حتى '+new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(new Date(result.expires_at))+' بتوقيت الرياض.':'تم إلغاء الحجز. العقد والتحصيلات لم تتغير.');
   onChanged();
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
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </section>;
}
