'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { portalRequest } from '@/lib/portal/client';
import { BillForm, billSchema, titles, totals, money, words, hijri, tlv } from '@/lib/bills/model';
import '@/app/bills-forms/print.css';
type Issued={number:string;form:BillForm;createdAt:string};
export default function BillsForms({initialKind='REC'}:{initialKind?:BillForm['kind']}){
 const {isExecutive}=useAuth();
 const [form,setForm]=useState<BillForm>({kind:initialKind,invoiceType:'rent',party:'',unit:'',date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),amount:'0',vat:false,method:'تحويل بنكي',reference:'',notes:'',nature:'إيراد للمكتب',bank:'',iban:'',condition:'',keys:''});
 const [issued,setIssued]=useState<Issued|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[manual,setManual]=useState(false),[attempt,setAttempt]=useState<{id:string;form:BillForm}|null>(null);
 const update=(key:keyof BillForm,value:unknown)=>{setForm(f=>({...f,[key]:value}));setAttempt(null);setError('');};
 const active=issued?.form||form, parsed=billSchema.safeParse(active), values=totals(/^\d{1,9}(\.\d{1,2})?$/.test(active.amount)?active.amount:'0',active.vat), wording=words(values.total);
 const fields: {key:keyof BillForm;label:string;type?:string}[]=[{key:'party',label:active.kind==='VOU'?'المستفيد':'العميل / المستأجر / المستلم'},{key:'unit',label:'العقار / الوحدة'},{key:'date',label:'التاريخ الميلادي',type:'date'},{key:'amount',label:'المبلغ قبل الضريبة (ر.س)'},{key:'reference',label:'مرجع العقد / العملية / الشيك'},{key:'bank',label:'البنك'},{key:'iban',label:'آيبان المستفيد'}];
 async function issue(){setError('');const result=billSchema.safeParse({...form,override:manual?form.override:undefined});if(!result.success){setError('راجع الحقول: الاسم والوحدة والتاريخ والمبلغ والتفاصيل مطلوبة أو غير صحيحة.');return;}const request=attempt||{id:crypto.randomUUID(),form:result.data};setAttempt(request);setBusy(true);try{setIssued(await portalRequest<Issued>('/api/bills-forms',{method:'POST',body:JSON.stringify({requestId:request.id,form:request.form})}));}catch(e){setError(e instanceof Error?e.message:'تعذر الإصدار');}finally{setBusy(false);}}
 return <div dir="rtl" className="bills-module space-y-5">
 <div className="bills-controls"><h1 className="text-2xl font-bold">الفواتير والسندات</h1><p className="text-slate-400 mt-2">نماذج كحل · معاينة فورية · طباعة وحفظ PDF</p></div>
 <div className="bills-grid grid xl:grid-cols-2 gap-6 items-start">
 <section className="bills-controls bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
 <fieldset disabled={busy||!!issued} className="space-y-4 disabled:opacity-70">
 <label className="block">نوع المستند<select className="bill-input" value={form.kind} onChange={e=>{update('kind',e.target.value);update('vat',false);update('override',undefined);setManual(false);}}>{Object.entries(titles).map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></label>
 {form.kind==='INV'&&<label className="block">نوع الفاتورة<select className="bill-input" value={form.invoiceType} onChange={e=>update('invoiceType',e.target.value)}><option value="rent">تأجير</option><option value="sale">بيع</option></select></label>}
 <div className="grid sm:grid-cols-2 gap-3">{fields.map(f=><label key={f.key} className="block text-sm">{f.label}<input className="bill-input" type={f.type||'text'} inputMode={f.key==='amount'?'decimal':undefined} value={String(form[f.key]??'')} maxLength={f.key==='iban'?34:150} onChange={e=>update(f.key,e.target.value)}/></label>)}</div>
 <p className="text-sm text-emerald-300">التاريخ الهجري: {hijri(form.date)}</p>
 <label className="block">طريقة الدفع<select className="bill-input" value={form.method} onChange={e=>update('method',e.target.value)}>{['نقداً','تحويل بنكي','شيك','مدى','رابط دفع'].map(m=><option key={m}>{m}</option>)}</select></label>
 <label className="block">طبيعة المبلغ<select className="bill-input" value={form.nature} onChange={e=>{update('nature',e.target.value);if(e.target.value==='أمانة طرف ثالث')update('vat',false);}}><option>إيراد للمكتب</option><option>أمانة طرف ثالث</option></select></label>
 {form.kind==='INV'&&form.nature!=='أمانة طرف ثالث'&&<label className="flex gap-2"><input type="checkbox" checked={form.vat} onChange={e=>update('vat',e.target.checked)}/>إضافة ضريبة القيمة المضافة 15%</label>}
 <label className="block">البيان / الغرض<textarea className="bill-input" maxLength={1200} value={form.notes} onChange={e=>update('notes',e.target.value)}/></label>
 {form.kind==='HND'&&<><label className="block">حالة الوحدة والعدادات والملاحظات<textarea className="bill-input" maxLength={1200} value={form.condition} onChange={e=>update('condition',e.target.value)}/></label><label className="block">المفاتيح والمرفقات<input className="bill-input" maxLength={100} value={form.keys} onChange={e=>update('keys',e.target.value)}/></label></>}
 {isExecutive&&<><label className="flex gap-2"><input type="checkbox" checked={manual} onChange={e=>{setManual(e.target.checked);setAttempt(null);}}/>تعيين الرقم يدوياً (الإدارة)</label>{manual&&<input aria-label="رقم المستند اليدوي" className="bill-input" placeholder={`${form.kind}-${form.date.slice(0,4)}-00001`} value={form.override||''} onChange={e=>update('override',e.target.value)}/>}</>}
 </fieldset>
 {error&&<p role="alert" className="text-red-300">{error}</p>}
 <div className="flex flex-wrap gap-3">{!issued?<button disabled={busy} onClick={issue} className="bg-emerald-700 rounded-xl px-5 py-3 disabled:opacity-50">{busy?'جارٍ الإصدار…':'حفظ وإصدار الرقم'}</button>:<><button onClick={()=>window.print()} className="bg-emerald-700 rounded-xl px-5 py-3">طباعة / حفظ PDF</button><button onClick={()=>{setIssued(null);setAttempt(null);setManual(false);setForm(f=>({...f,override:undefined}));}} className="border rounded-xl px-5 py-3">مستند جديد</button></>}
 <button disabled={!parsed.success||!!issued} onClick={()=>window.print()} className="border border-slate-600 rounded-xl px-5 py-3 disabled:opacity-40">طباعة مسودة</button></div>
 <p className="text-xs text-slate-400">من نافذة الطباعة اختر Save as PDF، مقاس A4، وعطّل ترويسة وتذييل المتصفح. المسودة لا تحجز رقماً. الإصدار يثبت محتوى المستند.</p>
 </section>
 <article className="bill-document" aria-label="معاينة المستند">
 <header><img src="/kohl-logo.png" alt="كحل العقارية"/><div>شركة كحل العقارية · Kohl Real Estate</div></header>
 <div className="bill-meta"><bdi>{issued?.number||'مسودة - غير صالحة للإصدار'}</bdi><span>{active.date} م · {hijri(active.date)} هـ</span><span>مالي / تشغيلي</span></div>
 <h2>{active.kind==='INV'?(active.invoiceType==='rent'?'فاتورة تأجير':'فاتورة بيع'):titles[active.kind]}</h2>
 <p className="bill-subtitle">{active.kind==='REC'?'Receipt Voucher · ليس فاتورة ضريبية':active.kind==='VOU'?'Payment Voucher':active.kind==='HND'?'Unit Handover':'Invoice'}</p>
 <table><tbody><tr><th>الطرف</th><td>{active.party||'—'}</td></tr><tr><th>العقار / الوحدة</th><td>{active.unit||'—'}</td></tr><tr><th>المرجع</th><td>{active.reference||'—'}</td></tr><tr><th>طريقة الدفع</th><td>{active.method} · {active.bank}</td></tr>{active.iban&&<tr><th>آيبان المستفيد</th><td><bdi>{active.iban}</bdi></td></tr>}<tr><th>البيان</th><td className="bill-multiline">{active.notes||'—'}</td></tr><tr><th>طبيعة المبلغ</th><td>{active.nature}</td></tr></tbody></table>
 {active.kind==='HND'?<table><tbody><tr><th>حالة الوحدة / العدادات</th><td className="bill-multiline">{active.condition||'—'}</td></tr><tr><th>المفاتيح والمرفقات</th><td>{active.keys||'—'}</td></tr></tbody></table>:<><table><tbody><tr><th>المبلغ قبل الضريبة</th><td><bdi>{money(values.net)}</bdi> ر.س</td></tr><tr><th>الضريبة {active.vat?'15%':'غير مطبقة'}</th><td><bdi>{money(values.tax)}</bdi> ر.س</td></tr><tr><th>الإجمالي</th><td><strong><bdi>{money(values.total)}</bdi> ر.س</strong></td></tr></tbody></table><p>{wording.ar}</p><p dir="ltr" className="bill-english">{wording.en}</p></>}
 {active.kind==='INV'&&<div className="bill-qr"><span>موضع رمز QR · تجهيز التكامل الضريبي</span><small>يلزم استكمال التحقق والتوقيع والتكامل قبل الاستخدام الضريبي.</small>{issued&&<details className="bills-controls"><summary>بيانات TLV التجريبية</summary><code className="break-all">{tlv(['شركة كحل العقارية','310753818700003',issued.createdAt,money(values.total).replaceAll(',',''),money(values.tax).replaceAll(',','')])}</code></details>}</div>}
 <div className="bill-signatures"><div>{active.kind==='HND'?'المسلّم':'المُعِدّ / المستلم عن الشركة'}<p>الاسم: __________________</p><p>التوقيع: _________________</p></div><div>{active.kind==='HND'?'المستلم':'الاعتماد'}<p>الاسم: __________________</p><p>التوقيع والختم: ____________</p></div></div>
 <footer>شركة كحل العقارية · س.ت 7008335676 · الرقم الضريبي 310753818700003<br/>ترخيص فال 1200048910 · العنوان الوطني JESA7213 · 0125784340 · kohlestate-ksa.com<br/>{active.kind} · {issued?.number||'مسودة'} · صفحة 1</footer>
 </article></div></div>;
}

