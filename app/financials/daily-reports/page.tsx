'use client';
import { runAuditedExport, auditedPrint } from '@/lib/audit/client';
import Link from 'next/link';
import { ZodError } from 'zod';
import { useEffect,useRef,useState } from 'react';
import { portalRequest } from '@/lib/portal/client';
import { riyadhDay } from '@/lib/navigation/workspace';
import { contentSchema,type KrContent,type KrReport } from '@/lib/kr/schema';
import KrReportView from '@/components/kr/KrReportView';
import KrManagementAccess from '@/components/kr/KrManagementAccess';
type Schedule={enabled:boolean;report_time:string;timezone:string};
type State={report:KrReport|null;recent:{report_date:string}[];schedule:Schedule;can_edit:boolean};
function downloadJson(value:unknown,name:string){void runAuditedExport(name,()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
export default function DailyReportsPage(){
 const [day,setDay]=useState(riyadhDay()),[report,setReport]=useState<KrReport|null>(null),[content,setContent]=useState<KrContent|null>(null);
 const [recent,setRecent]=useState<State['recent']>([]),[schedule,setSchedule]=useState<Schedule|null>(null),[canEdit,setCanEdit]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState(''),[dirty,setDirty]=useState(false);
 const request=useRef(0);
 async function load(selected=day){const serial=++request.current;setLoading(true);setError('');setMessage('');setReport(null);setContent(null);setCanEdit(false);setDirty(false);
  try{const result=await portalRequest<State>(`/api/financials/kr?date=${selected}`);if(serial!==request.current)return;setReport(result.report);setContent(result.report?.content||null);setRecent(result.recent);setSchedule(result.schedule);setCanEdit(result.can_edit);}catch(e){if(serial===request.current)setError(e instanceof Error?e.message:'تعذر تحميل التقرير');}finally{if(serial===request.current)setLoading(false);}}
 useEffect(()=>{void load(day);return()=>{request.current++;};},[day]);
 useEffect(()=>{if(!dirty)return;const handler=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
 const editable=!!report&&canEdit&&!busy;
 function selectDate(value:string){if(!value)return;if(dirty&&!window.confirm('هناك تعديلات غير محفوظة. الانتقال دون حفظ؟'))return;setDay(value);}
 async function refreshState(){const result=await portalRequest<State>(`/api/financials/kr?date=${day}`);setRecent(result.recent);if(result.report)setReport(result.report);setCanEdit(result.can_edit);}
 async function mutate(operation:'PREPARE'|'SAVE'){setBusy(true);setError('');setMessage('');try{
  const payload={operation,report_date:day,revision:report?.revision,...(operation==='SAVE'?{content:contentSchema.parse(content)}:{})};
  const result=await portalRequest<{report:KrReport}>('/api/financials/kr',{method:'POST',body:JSON.stringify(payload)});
  setReport(result.report);setContent(result.report.content);setDirty(false);setMessage('تم حفظ التقرير وإتاحته للإدارة وتحديث الأجندة.');await refreshState();
 }catch(e){setError(e instanceof ZodError?'راجع الحقول ومواعيد خطة اليوم التالي بتوقيت الرياض.':e instanceof Error?e.message:'تعذر حفظ التقرير');}finally{setBusy(false);}}
 async function importFile(file?:File){if(!file)return;if(file.size>1024*1024){setError('حجم JSON يتجاوز1 MB');return;}setBusy(true);setError('');setMessage('');try{
  const input=JSON.parse(await file.text());if(input.report_date!==day)throw new Error('اختر تاريخ التقرير المطابق لملف JSON أولاً.');
  const result=await portalRequest<{report:KrReport}>('/api/financials/kr/import',{method:'POST',body:JSON.stringify({...input,revision:report?.revision})});
  setReport(result.report);setContent(result.report.content);setDirty(false);setMessage('تم استيراد التقرير وإتاحته للإدارة وتحديث الأجندة؛ الأرقام المالية من ERP.');await refreshState();
 }catch(e){setError(e instanceof Error?e.message:'ملف JSON غير صالح');}finally{setBusy(false);}}
 async function downloadVersion(revision:number){setBusy(true);setError('');try{const result=await portalRequest<{snapshot:unknown}>(`/api/financials/kr?date=${day}&revision=${revision}`);downloadJson(result.snapshot,`KR-${day}-revision-${revision}.json`);}catch(e){setError(e instanceof Error?e.message:'تعذر تنزيل النسخة السابقة');}finally{setBusy(false);}}
 async function saveSchedule(enabled:boolean,time:string){setBusy(true);setError('');try{const result=await portalRequest<{schedule:Schedule}>('/api/financials/kr/schedule',{method:'PATCH',body:JSON.stringify({enabled,report_time:time.slice(0,5)})});setSchedule(result.schedule);setMessage('تم حفظ موعد إعداد التقرير بتوقيت الرياض.');}catch(e){setError(e instanceof Error?e.message:'تعذر حفظ الجدولة');}finally{setBusy(false);}}
 return <div className="space-y-5 kr-workspace" dir="rtl"><div className="kr-edit-control space-y-4">
  <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="text-2xl font-bold">تقرير اليوم KR</h1><p>تقرير يومي للإدارة · أربعة أقسام · توقيت الرياض</p></div><label>تاريخ التقرير<input type="date" className="portal-input" value={day} disabled={busy} onChange={e=>selectDate(e.target.value)}/></label></div>
  <p>التقرير المحفوظ متاح مباشرة للمسؤول العام والرئيس التنفيذي والمديرين المخولين. يمكن اختيار أي يوم سابق؛ التعديلات تحفظ كسجل إصدارات.</p>
  {canEdit&&<Link className="underline" href="/financials/daily-reports/legacy">التقارير السابقة والتحليل AI</Link>}
  <div className="flex flex-wrap gap-3">
   {canEdit&&<><button className="portal-button" disabled={busy||loading||dirty} onClick={()=>void mutate('PREPARE')}>{report?'تحديث لقطة المصادر':'إعداد من المصادر'}</button><button className="portal-button" disabled={!editable||!dirty} onClick={()=>void mutate('SAVE')}>حفظ التقرير</button><label className="underline">استيراد Claude / هاتف JSON<input aria-label="استيراد تقرير JSON" type="file" accept="application/json,.json" disabled={busy||dirty} className="block text-sm max-w-56" onChange={e=>{const file=e.target.files?.[0];e.target.value='';void importFile(file);}}/></label></>}
   <button disabled={busy||loading||dirty} className="underline" onClick={()=>void load()}>إعادة تحميل</button><button className="underline" disabled={!report||dirty||busy} onClick={()=>void auditedPrint()}>طباعة / حفظ PDF</button><button className="underline" disabled={!content||busy} onClick={()=>content&&downloadJson({event_id:crypto.randomUUID(),report_date:day,content},`KR-${day}.json`)}>تصدير JSON</button>
  </div>
  {schedule&&<details><summary>الجدولة اليومية · {schedule.enabled?'مفعلة':'متوقفة'} · {schedule.report_time.slice(0,5)} Asia/Riyadh</summary><p>إعداد التقرير وإتاحته مباشرة للإدارة عند الموعد المحدد، مع تحديث مهام اليوم التالي.</p>{canEdit&&<><label>موعد إعداد التقرير<input type="time" value={schedule.report_time.slice(0,5)} disabled={busy} onChange={e=>void saveSchedule(schedule.enabled,e.target.value)}/></label><label className="mx-3"><input type="checkbox" checked={schedule.enabled} disabled={busy} onChange={e=>void saveSchedule(e.target.checked,schedule.report_time)}/> تفعيل الجدولة</label></>}</details>}
  {canEdit&&<KrManagementAccess/>}
  {!!recent.length&&<details><summary>آخر التقارير المحفوظة</summary><div className="flex flex-wrap gap-3">{recent.map(item=><button type="button" className="underline" key={item.report_date} disabled={busy} onClick={()=>selectDate(item.report_date)}>{item.report_date}</button>)}</div></details>}
  {!!report?.previous_versions?.length&&<details className="portal-card"><summary>سجل الإصدارات السابقة</summary>{report.previous_versions.map(v=><div className="py-2" key={v.revision}><p>الإصدار {v.revision} · {v.actor_name}</p><p>{v.reason}</p><button className="underline" disabled={busy} onClick={()=>void downloadVersion(v.revision)}>تنزيل نسخة الإصدار {v.revision}</button></div>)}</details>}
  {error&&<p role="alert" className="text-red-500 whitespace-pre-wrap">{error}</p>}{message&&<p role="status" className="text-emerald-600">{message}</p>}{dirty&&<p role="status">تعديلات غير محفوظة؛ احفظها لإتاحتها للإدارة وتحديث الأجندة.</p>}{loading&&<p role="status">جارٍ تحميل تقرير KR…</p>}
  {report&&<><p>الحالة: محفوظ ومرئي للإدارة · الإصدار {report.revision}</p>{!canEdit&&<p>صلاحية مشاهدة التقارير فقط.</p>}{report.facts.warnings.length>0&&<ul className="kr-source-warnings">{report.facts.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>}</>}
  {!report&&!loading&&!error&&<p>{canEdit?'لا يوجد تقرير محفوظ لهذا التاريخ. أعدّه من المصادر أو استورد JSON.':'لا يوجد تقرير محفوظ لهذا التاريخ.'}</p>}
 </div>{report&&content&&<KrReportView report={report} content={content} editable={editable} onChange={value=>{setContent(value);setDirty(true);setMessage('');}}/>}</div>;
}
