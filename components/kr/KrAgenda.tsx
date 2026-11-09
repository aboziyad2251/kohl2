'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { reportDate } from '@/lib/kr/schema';
import { riyadhDay } from '@/lib/navigation/workspace';
import { useWorkspaceData } from '@/components/navigation/useWorkspaceData';
import { portalRequest } from '@/lib/portal/client';
import { useAuth } from '@/context/AuthContext';
type Task={id:string;action:string;contact:string;owner:string;assigned_user_id:string|null;due_at:string;indicator:string;status:string};
export default function KrAgenda(){
 const queryDay=useSearchParams().get('date'), initial=reportDate.safeParse(queryDay);
 const {role}=useAuth(),[day,setDay]=useState(initial.success?initial.data:riyadhDay()),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const {data,loading,error:loadError,refresh}=useWorkspaceData<{tasks:Task[];limited:boolean}>(`/api/workspace/agenda?date=${day}`);
 useEffect(()=>{if(initial.success)setDay(initial.data);},[queryDay]);
 if(role==='HR')return null;
 async function complete(task:Task){setBusy(task.id);setError('');try{await portalRequest(`/api/workspace/agenda/${task.id}`,{method:'PATCH',body:JSON.stringify({status:task.status==='COMPLETED'?'PENDING':'COMPLETED'})});refresh();}catch(e){setError(e instanceof Error?e.message:'تعذر تحديث البند');}finally{setBusy('');}}
 return <section className="workspace-card space-y-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">أجندة كحل · خطة KR المحفوظة</h2><p>بنود تُحدّث من التقرير المحفوظ لليوم السابق. المواعيد بتوقيت الرياض.</p></div><label>تاريخ الأجندة<input aria-label="تاريخ أجندة KR" type="date" value={day} onChange={e=>e.target.value&&setDay(e.target.value)}/></label></div>{(error||loadError)&&<p role="alert">{error||loadError}</p>}{loading&&<p role="status">جارٍ تحميل الأجندة…</p>}{data?.limited&&<p>يعرض أول500 بند.</p>}{data&&!data.tasks.length&&<p>لا توجد بنود KR متاحة لهذا التاريخ.</p>}<ul className="space-y-3">{data?.tasks.map(task=><li key={task.id} className="border rounded-xl p-3"><strong>{task.action}</strong><p>{task.owner} · {task.contact} · {new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',hour:'2-digit',minute:'2-digit'}).format(new Date(task.due_at))}</p><p>مؤشر الإنجاز: {task.indicator}</p>{!task.assigned_user_id&&<p>يحتاج ربط المسؤول بحساب داخلي بواسطة الإدارة.</p>}<button className="underline" disabled={!!busy} onClick={()=>void complete(task)}>{task.status==='COMPLETED'?'إعادة للمتابعة':'تحديد كمكتمل'}</button></li>)}</ul></section>;
}
