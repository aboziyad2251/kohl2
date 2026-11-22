import { z } from 'zod';
import { validatePeriod, suggestRequirements } from '@/lib/operations/availability';
export const purposes = ['SALE','RENT'] as const;
export const periods = ['DAILY','MONTHLY','ANNUAL'] as const;
export const fields = ['budget','city','district','kind','rooms','entrances','area'] as const;
const number=z.number().finite().positive().max(999999999).nullable();
const count=z.number().int().positive().max(100).nullable();
export const profileSchema=z.object({
 purpose:z.enum(purposes), period:z.enum(periods).nullable(), city:z.string().trim().max(100), district:z.string().trim().max(100), kind:z.string().trim().max(100),
 rooms:count, entrances:count, area:number, price:number, budget:number,
 from:z.string().max(10), to:z.string().max(10), unit_id:z.string().uuid().nullable(),
 hard:z.array(z.enum(fields)).max(7), status:z.enum(['ACTIVE','PAUSED','CLOSED']),
}).strict().superRefine((v,c)=>{
 if(v.purpose==='RENT'&&!v.period)c.addIssue({code:'custom',message:'حدد دورة الإيجار'});
 if(v.from||v.to){try{validatePeriod({start:v.from,end:v.to});}catch{c.addIssue({code:'custom',message:'راجع الفترة'});}}
});
export type Profile=z.infer<typeof profileSchema>;
export const emptyProfile=(purpose:'SALE'|'RENT'):Profile=>({purpose,period:purpose==='RENT'?'ANNUAL':null,city:'',district:'',kind:'',rooms:null,entrances:null,area:null,price:null,budget:null,from:'',to:'',unit_id:null,hard:['budget'],status:'ACTIVE'});
export const eventSchema=z.object({id:z.string().uuid(),request_id:z.string().uuid(),property_id:z.string().uuid(),stage:z.enum(['CONTACTED','VIEWING','OFFER','WON','REJECTED']),reason:z.string().trim().max(500)}).strict().refine(v=>v.stage!=='REJECTED'||v.reason.length>0,'سجل سبب الرفض');
export type Match={id:string;score:number;reasons:string[];warnings:string[];eligible:boolean};
export type Availability={available:boolean;reason:string};
export function normalize(v:string){return v.normalize('NFKD').replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase().trim();}
/** Hard constraints fail closed. Scores measure requirement fit, not conversion probability. */
export function match(id:string,request:Profile,listing:Profile,availability?:Availability):Match {
 const reasons:string[]=[],warnings:string[]=[];let eligible=true,earned=0,total=0;
 if(request.hard.some(k=>request[k]===null||request[k]===''))return {id,score:0,reasons:[],warnings:['أكمل قيمة كل شرط إلزامي في الطلب'],eligible:false};
 if(request.purpose!==listing.purpose||request.status!=='ACTIVE'||listing.status!=='ACTIVE')return {id,score:0,reasons:[],warnings:['الغرض أو حالة العرض غير مناسب'],eligible:false};
 if(request.purpose==='RENT'){
  if(!request.from||!request.to||!listing.unit_id||availability?.available!==true){eligible=false;warnings.push('لا يمكن الترشيح قبل تأكيد توفر الوحدة خلال الفترة');}
  if(request.period!==listing.period){eligible=false;warnings.push('دورة تسعير الإيجار مختلفة؛ لا نقارن أسعاراً غير متكافئة');}
 }
 const labels:Record<string,string>={budget:'الميزانية',city:'المدينة',district:'الحي',kind:'نوع العقار',rooms:'الغرف',entrances:'المداخل',area:'المساحة'};
 const weights={budget:30,city:20,district:15,kind:15,rooms:10,entrances:5,area:5};
 for(const field of fields){
  const needed=request[field];if(needed===null||needed==='')continue;
  total+=weights[field];const actual=field==='budget'?listing.price:listing[field];
  const known=actual!==null&&actual!=='';
  const ok=known&&(field==='budget'?Number(actual)<=Number(needed):field==='area'?Number(actual)>=Number(needed):typeof needed==='string'?normalize(String(actual))===normalize(needed):actual===needed);
  if(ok){earned+=weights[field];reasons.push(labels[field]+' مطابق');}
  else {warnings.push(labels[field]+(known?' غير مطابق':' تحتاج تأكيداً'));if(request.hard.includes(field))eligible=false;}
 }
 if(!total){eligible=false;warnings.push('حدد مواصفة واحدة على الأقل قبل المطابقة');}
 return {id,score:total?Math.round(100*earned/total):0,reasons,warnings,eligible};
}
export function suggest(text:string){const s=suggestRequirements(text);return {rooms:s.bedrooms,entrances:s.entrances};}
