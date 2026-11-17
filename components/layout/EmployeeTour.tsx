'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { tourSteps, tourStorageKey } from '@/lib/onboarding/tour';

export default function EmployeeTour() {
 const auth=useAuth(),router=useRouter();
 const steps=tourSteps(auth.canAccess);
 const [index,setIndex]=useState(0),[open,setOpen]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),restart=useRef<HTMLButtonElement>(null);
 const key=tourStorageKey(auth.currentUser.id);
 const step=steps[Math.min(index,steps.length-1)];
 useEffect(()=>{try {if(!localStorage.getItem(key))setOpen(true);} catch {setOpen(true);}},[key]);
 useEffect(()=>{
  const element=dialog.current;if(!element)return;
  if(open&&!element.open)element.showModal();
  if(!open&&element.open)element.close();
  if(!open)return;
  const previous=document.body.style.overflow;document.body.style.overflow='hidden';
  return ()=>{document.body.style.overflow=previous;};
 },[open]);
 function finish(status: 'skipped'|'completed') {
  try {localStorage.setItem(key,status);} catch {/* Still allow closing when storage is unavailable. */}
  setOpen(false);setIndex(0);restart.current?.focus();
 }
 return <>
  <button ref={restart} type="button" className="fixed bottom-24 left-4 z-40 rounded-full border bg-white text-slate-900 shadow-lg px-4 py-2" onClick={()=>setOpen(true)}>جولة النظام</button>
  <dialog ref={dialog} dir="rtl" aria-labelledby="employee-tour-title" onCancel={event=>{event.preventDefault();finish('skipped');}}
   className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border p-5 bg-white text-slate-900 shadow-xl backdrop:bg-black/50 max-h-[85dvh] overflow-y-auto">
   <div className="flex justify-between gap-3 items-center"><span aria-live="polite">الخطوة {Math.min(index+1,steps.length)} من {steps.length}</span><button type="button" onClick={()=>finish('skipped')} className="underline p-2">تخطّي الجولة</button></div>
   <progress aria-label="تقدم الجولة" value={index+1} max={steps.length} className="w-full my-3" />
   <h2 id="employee-tour-title" className="text-xl font-bold mb-3">{step.title}</h2>
   <p className="leading-8 mb-5" aria-live="polite">{step.body}</p>
   {step.href&&<button type="button" className="border rounded-lg px-4 py-2 mb-4" onClick={()=>{setOpen(false);router.push(step.href!);}}>فتح قسم {step.title}</button>}
   <label className="block text-sm mb-5">انتقل إلى خطوة<select className="block w-full border rounded-lg p-2 mt-2 bg-white text-slate-900" value={Math.min(index,steps.length-1)} onChange={event=>setIndex(Number(event.target.value))}>{steps.map((item,i)=><option key={item.id} value={i}>{i+1}. {item.title}</option>)}</select></label>
   <div className="flex justify-between gap-3"><button type="button" disabled={index===0} onClick={()=>setIndex(i=>Math.max(0,i-1))} className="border rounded-lg px-5 py-2 disabled:opacity-40">السابق</button>
   <button type="button" autoFocus className="rounded-lg px-5 py-2 bg-emerald-700 text-white" onClick={()=>index>=steps.length-1?finish('completed'):setIndex(i=>i+1)}>{index>=steps.length-1?'إنهاء الجولة':'التالي'}</button></div>
  </dialog>
 </>;
}
