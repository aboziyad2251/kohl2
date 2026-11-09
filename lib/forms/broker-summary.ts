import { z } from 'zod';
const day=z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+'T12:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;});
const optionalDate=z.union([day,z.literal('')]);
export const brokerSummarySchema=z.object({kind:z.literal('KC-M'),date:day,values:z.object({
 agreement_number:z.string().trim().min(1).max(20),representative:z.string().trim().min(2).max(60),
 broker_name:z.string().trim().min(3).max(60),broker_national_id:z.string().regex(/^1\d{9}$/),
 fal_number:z.string().regex(/^\d{5,20}$/),fal_expiry:day,mobile:z.string().regex(/^05\d{8}$/),vehicle:z.string().trim().max(35),
 start_date:day,end_date:day,broker_share:z.number().min(0).max(100).multipleOf(0.01),penalty_amount:z.number().min(0).max(99999999.99).multipleOf(0.01),
 prepared_date:optionalDate,acknowledged_name:z.string().trim().max(60),acknowledged_date:optionalDate,approved_date:optionalDate,
 checks:z.object({raci:z.boolean(),disclosures:z.boolean(),trial:z.boolean(),license_register:z.boolean(),agreement_archive:z.boolean(),penalty_authorized:z.boolean()}).strict()
}).strict()}).strict().superRefine((f,c)=>{if(f.values.end_date<f.values.start_date)c.addIssue({code:'custom',path:['values','end_date'],message:'نهاية المدة تسبق بدايتها'});if(f.values.fal_expiry<f.values.end_date)c.addIssue({code:'custom',path:['values','fal_expiry'],message:'يلزم سريان رخصة فال طوال مدة الاتفاق'});});
export type BrokerSummary=z.infer<typeof brokerSummarySchema>;
export const checklist=[['raci','توقيع مصفوفة المهام والصلاحيات RACI'],['disclosures','إقرارات السرية وتعارض المصالح والعمولات'],['trial','تجربة90 يوماً بمؤشرات12.5 الشهرية'],['license_register','قيد الرخصة في سجل تراخيص فال'],['agreement_archive','حفظ الاتفاق ومرفقاته في الملحق م-10'],['penalty_authorized','اعتماد الشرط الجزائي من المدير التنفيذي']] as const;
export function summaryDefaults(date:string):BrokerSummary{return {kind:'KC-M',date,values:{agreement_number:'',representative:'',broker_name:'',broker_national_id:'',fal_number:'',fal_expiry:'',mobile:'',vehicle:'',start_date:date,end_date:date,broker_share:0,penalty_amount:0,prepared_date:'',acknowledged_name:'',acknowledged_date:'',approved_date:'',checks:{raci:false,disclosures:false,trial:false,license_register:false,agreement_archive:false,penalty_authorized:false}}};}
export function summaryComputed(f:BrokerSummary){const d=f.values;return {duration:Math.floor((Date.parse(d.end_date)-Date.parse(d.start_date))/86400000)+1,company_share:Math.round((100-d.broker_share)*100)/100,hijri:new Intl.DateTimeFormat('en-GB-u-ca-islamic-umalqura',{timeZone:'Asia/Riyadh',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(f.date+'T12:00:00+03:00')).replace(/\s?AH$/,'')};}
