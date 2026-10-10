'use client';
import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { portalRequest } from '@/lib/portal/client';
import { Template, fieldLimit } from '@/lib/forms/templates';
import { standardSchema, StandardForm, computedValues } from '@/lib/forms/model';
import { hijri } from '@/lib/bills/model';
import '@/app/bills-forms/print.css';
import './standard.css';
type Issued={number:string;form:StandardForm;createdAt:string};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export default function StandardEditor({template}:{template:Template}){
 const {isExecutive}=useAuth();const [form,setForm]=useState<StandardForm>({kind:template.code,date:today(),values:{}});
 const [issued,setIssued]=useState<Issued|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[manual,setManual]=useState(false),[attempt,setAttempt]=useState<{id:string;form:StandardForm}|null>(null);
 const paper=useRef<HTMLDivElement>(null);const active=issued?.form||form;const computed=computedValues(active);
 const change=(key:string,value:string)=>{setForm(old=>({...old,values:{...old.values,[key]:value}}));setAttempt(null);setError('');};
 function validate(){const parsed=standardSchema.safeParse({...form,override:manual?form.override:undefined});if(!parsed.success){setError(parsed.error.issues.map(i=>i.message).slice(0,4).join(' · '));return null;}
  const clipped=Array.from(paper.current?.querySelectorAll<HTMLElement>('[data-field]')||[]).filter(el=>el.scrollHeight>el.clientHeight+2||el.scrollWidth>el.clientWidth+2);
  if(clipped.length){setError('النص يتجاوز مساحة الخانة: '+clipped.map(el=>el.dataset.label).join('، '));return null;}return parsed.data;}
 async function issue(){const input=validate();if(!input)return;setBusy(true);setError('');const request=attempt||{id:crypto.randomUUID(),form:input};setAttempt(request);try{setIssued(await portalRequest<Issued>('/api/bills-forms/standard',{method:'POST',body:JSON.stringify({requestId:request.id,form:request.form})}));}catch(e){setError(e instanceof Error?e.message:'تعذر إصدار المستند');}finally{setBusy(false);}}
 async function print(){if(!issued&&!validate())return;try{await Promise.all(Array.from(paper.current?.querySelectorAll('img')||[]).map(img=>img.decode()));await document.fonts.ready;window.print();}catch{setError('تعذر تحميل صفحات النموذج للطباعة. أعد المحاولة.');}}
 const numberedDate=new Intl.DateTimeFormat('en-GB-u-ca-islamic-umalqura',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date((/^\d{4}-\d{2}-\d{2}$/.test(active.date)&&!isNaN(Date.parse(active.date))?active.date:today())+'T12:00:00Z'));
 const metaX={KL:[447,292,179],KM:[444,280,167],KP:[446,282,169],KQ:[445,299,186],KR:[446,299,186],KB:[446,297,184],KA:[446,297,184],'KC-L':[440,275,162],'KC-B':[438,274,161],KS:[446,284,172]}[template.code]!;
 return <div dir="rtl" className="bills-module standard-module space-y-5">
 <div className="bills-controls"><h1 className="text-2xl font-bold">{template.title}</h1><p className="text-slate-400 mt-2">{template.code} · الثوابت من النموذج الأصلي · أدخل المتغيرات فقط</p></div>
 <div className="grid xl:grid-cols-2 gap-6 items-start">
 <section className="bills-controls rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-5">
 <fieldset disabled={busy||!!issued} className="space-y-4 disabled:opacity-70">
 <label className="block">تاريخ المستند<input className="bill-input" type="date" value={form.date} onChange={e=>{setForm(old=>({...old,date:e.target.value}));setAttempt(null);}}/></label><p className="text-sm text-emerald-300">{hijri(form.date)}</p>
 {Array.from({length:template.pages},(_,index)=><div key={index} className="space-y-3"><h2 className="font-bold border-b border-slate-700 pb-2">متغيرات الصفحة {index+1}</h2><div className="grid sm:grid-cols-2 gap-3">{template.fields.filter(f=>f.page===index+1&&!f.computed).map(field=><label key={field.key} data-input-key={field.key} className={'block text-sm '+(field.type==='area'?'sm:col-span-2':'')}>{field.label}{field.required?' *':''}
 {field.options?<select className="bill-input" value={form.values[field.key]||''} onChange={e=>change(field.key,e.target.value)}><option value="">— اختر —</option>{field.options.map(option=><option key={option}>{option}</option>)}</select>:field.type==='area'?<textarea className="bill-input" rows={Math.min(5,Math.max(2,Math.floor(field.h/15)))} maxLength={fieldLimit(field)} value={form.values[field.key]||''} onChange={e=>change(field.key,e.target.value)}/>:<input className="bill-input" type={field.type==='date'?'date':'text'} inputMode={field.type==='money'?'decimal':field.type==='count'?'numeric':undefined} maxLength={fieldLimit(field)} value={form.values[field.key]||''} onChange={e=>change(field.key,e.target.value)}/>}</label>)}</div></div>)}
 {isExecutive&&<><label className="flex gap-2"><input type="checkbox" checked={manual} onChange={e=>{setManual(e.target.checked);setAttempt(null);}}/>تعيين الرقم يدوياً (الإدارة)</label>{manual&&<input className="bill-input" aria-label="رقم المستند اليدوي" placeholder={template.code+'-'+form.date.slice(0,4)+'-00001'} value={form.override||''} onChange={e=>{setForm(old=>({...old,override:e.target.value}));setAttempt(null);}}/>}</>}
 </fieldset>
 {error&&<p role="alert" className="text-red-300">{error}</p>}
 <div className="flex flex-wrap gap-3">{!issued?<button className="bg-emerald-700 rounded-xl px-4 py-3 disabled:opacity-50" disabled={busy} onClick={issue}>{busy?'جارٍ الإصدار…':'حفظ وإصدار الرقم'}</button>:<button className="border rounded-xl px-4 py-3" onClick={()=>{setIssued(null);setForm({kind:template.code,date:today(),values:{}});setAttempt(null);setManual(false);setError('');}}>مستند جديد</button>}<button className="border border-slate-600 rounded-xl px-4 py-3" disabled={busy} onClick={print}>{issued?'طباعة / حفظ PDF':'طباعة مسودة'}</button></div>
 <p className="text-xs text-slate-400">الحقول الفارغة تبقى فارغة. التوقيعات والختم تُستكمل بعد الطباعة. الإصدار يحفظ نسخة ثابتة؛ المسودة لا تحجز رقماً. اختر A4، الهوامش: لا شيء، وعطّل ترويسة وتذييل المتصفح.</p>
 {['KP','KQ'].includes(template.code)&&<p className="text-sm text-emerald-300">الإجمالي: {computed.total} ر.س · الضريبة 15%: {computed.tax} ر.س. مبالغ البنود إجماليات البنود، وليست أسعار وحدات.</p>}
 </section>
 <div className="standard-preview"><div className="standard-print" ref={paper}>{Array.from({length:template.pages},(_,index)=><article aria-label={'معاينة '+template.title+' صفحة '+(index+1)} className="standard-sheet" key={index}>
 <img src={`/forms/kohl/${template.code}-${index+1}.png`} alt={'النموذج الأصلي '+template.title+' صفحة '+(index+1)} className="standard-background"/>
 {index===0&&[issued?.number||'مسودة',active.date,numberedDate].map((value,i)=><span key={i} className="standard-value standard-meta" style={{left:metaX[i]/595.275591*100+'%',top:86/841.889764*100+'%',width:(i===0?62:i===1?71:76)/595.275591*100+'%',height:13/841.889764*100+'%',fontSize:'1.15cqw'}}>{value}</span>)}
 {template.fields.filter(f=>f.page===index+1&&!f.inputOnly).map(field=>{const value=field.computed?computed[field.key]:active.values[field.key];if(!value)return null;
  if(field.marks&&field.options){const selected=field.options.indexOf(value),x=field.marks[selected],y=field.marksY?.[selected]??field.y;return <span key={field.key} className="standard-check" style={{left:x/595.275591*100+'%',top:y/841.889764*100+'%',fontSize:'1.5cqw'}}>✓</span>;}
  return <span key={field.key} data-field={field.key} data-label={field.label} className="standard-value" style={{left:field.x/595.275591*100+'%',top:field.y/841.889764*100+'%',width:field.w/595.275591*100+'%',height:field.h/841.889764*100+'%',fontSize:(field.size||9)/595.275591*100+'cqw'}}>{value}</span>;})}
 </article>)}</div></div>
 </div></div>;
}

