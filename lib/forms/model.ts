import { z } from 'zod';
import { templates, fieldLimit } from './templates';
import { totals, money, words } from '@/lib/bills/model';
export const standardSchema=z.object({kind:z.string(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),values:z.record(z.string()),override:z.string().optional()}).strict().superRefine((input,ctx)=>{
 const template=templates.find(t=>t.code===input.kind);
 const fail=(message:string,path:(string|number)[]=[])=>ctx.addIssue({code:'custom',message,path});
 if(!template){fail('نوع المستند غير صحيح');return;}
 const validDate=(s:string)=>{const d=new Date(s+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s&&Number(s.slice(0,4))>=1900&&Number(s.slice(0,4))<=2200;};
 if(!validDate(input.date))fail('التاريخ غير صحيح',['date']);
 const allowed=new Set(template.fields.filter(f=>!f.computed).map(f=>f.key));
 for(const key of Object.keys(input.values))if(!allowed.has(key))fail('حقل غير مسموح',['values',key]);
 for(const field of template.fields.filter(f=>!f.computed)){
  const value=input.values[field.key]||'';const path=['values',field.key];
  if(field.required&&!value.trim())fail(field.label+' مطلوب',path);
  if(value.length>fieldLimit(field))fail(field.label+' يتجاوز سعة الخانة',path);
  if(!value)continue;
  if(field.type==='date'&&!validDate(value))fail(field.label+' غير صحيح',path);
  if(field.type==='money'&&!/^\d{1,8}(\.\d{1,2})?$/.test(value))fail(field.label+' يجب أن يكون مبلغاً موجباً بحد أقصى منزلتين',path);
  if(field.type==='count'&&!/^\d{1,7}$/.test(value))fail(field.label+' يجب أن يكون عدداً صحيحاً',path);
  if(field.options&&!field.options.includes(value))fail(field.label+' غير صحيح',path);
 }
 if(input.override&&!new RegExp('^'+input.kind+'-'+input.date.slice(0,4)+'-([0-9]{5,9})$').test(input.override))fail('رقم المستند يجب أن يطابق النوع والسنة',['override']);
 if(input.override&&Number(input.override.split('-').at(-1))===0)fail('رقم التسلسل يبدأ من 1',['override']);
 const v=input.values;
 if(v.start&&v.end&&v.end<v.start)fail('نهاية المدة تسبق بدايتها');
 if(v.from&&v.to&&v.to<v.from)fail('نهاية الفترة تسبق بدايتها');
 if(input.kind==='KC-L'&&v.rent&&[0,1,2,3].some(i=>v['installment.'+i+'.amount'])){
  const sum=[0,1,2,3].reduce((s,i)=>s+halalas(v['installment.'+i+'.amount']),0);
  if(sum!==halalas(v.rent))fail('مجموع دفعات الإيجار يجب أن يساوي الأجرة الإجمالية');
 }
 if(input.kind==='KC-B'&&Number(v.percentage||0)>100)fail('النسبة يجب ألا تتجاوز 100%');
 if(input.kind==='KC-M'&&Number(v.brokerShare||0)>100)fail('حصة المسوّق يجب ألا تتجاوز 100%');
 if(input.kind==='KC-B'&&Number(v.percentage||0)>0&&Number(v.fixedFee||0)>0)fail('اختر نسبة أتعاب أو مبلغاً مقطوعاً');
 if(input.kind==='KB'&&halalas(v.trustPaid)>[0,1,2].reduce((s,i)=>s+halalas(v['expense.'+i+'.amount']),0))fail('الأمانات المسددة لا تتجاوز المصروفات');
});
export type StandardForm=z.infer<typeof standardSchema>;
export function halalas(s?:string){return /^\d{1,8}(\.\d{1,2})?$/.test(s||'')?totals(s!,false).net:0;}
export function computedValues(form:StandardForm):Record<string,string>{
 const v=form.values;const sum=(prefix:string,key:string,count:number)=>Array.from({length:count},(_,i)=>halalas(v[`${prefix}.${i}.${key}`])).reduce((a,b)=>a+b,0);
 if(form.kind==='KC-M'){
  const date=new Date(form.date+'T12:00:00Z'),start=Date.parse(v.start||''),end=Date.parse(v.end||'');
  const validShare=/^\d{1,3}(\.\d{1,2})?$/.test(v.brokerShare||'')&&Number(v.brokerShare)<=100;
  return {agreementDate:form.date,agreementHijri:!isNaN(date.getTime())?new Intl.DateTimeFormat('en-GB-u-ca-islamic-umalqura',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(date).replace(/\s?AH$/,''):'',duration:Number.isFinite(start)&&Number.isFinite(end)&&end>=start?String(Math.round((end-start)/86400000)+1):'',companyShare:validShare?String(Math.round(10000-Number(v.brokerShare)*100)/100):'',signRepresentative:v.representative||'',signCapacity:v.capacity||'',signRepresentativeId:v.representativeId||'',signBroker:v.brokerName||'',signBrokerId:v.brokerId||'',signFal:v.fal||''};
 }
 if(form.kind==='KP'||form.kind==='KQ'){
  const net=sum(form.kind==='KP'?'fee':'item','amount',form.kind==='KP'?3:4),tax=Math.round(net*15/100),total=net+tax;
  return {net:money(net),tax:money(tax),total:money(total),amountWords:words(total).ar};
 }
 if(form.kind==='KC-L')return {rentWords:words(halalas(v.rent)).ar};
 if(form.kind==='KC-B')return {feeType:Number(v.percentage||0)>0?'نسبة':Number(v.fixedFee||0)>0?'مبلغ مقطوع':''};
 if(form.kind==='KB'){
  const income=sum('receipt','income',4),trust=sum('receipt','trust',4),tax=sum('receipt','tax',4),paid=sum('expense','amount',3),received=income+trust+tax;
  return Object.fromEntries(Object.entries({incomeSum:income,trustSum:trust,taxSum:tax,expenses:paid,received,paid,income,tax,trust:trust-halalas(v.trustPaid),closing:halalas(v.opening)+received-paid}).map(([k,n])=>[k,money(n)]));
 }
 return {};
}
