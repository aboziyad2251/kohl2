import { z } from 'zod';
import type { WorkBook } from 'xlsx';
import { normalizeDigits } from '@/lib/property-import';
export type ImportColumn={key:string;label:string;type:'text'|'uuid'|'count'|'number'|'boolean'|'choices'|'purposes'|'floor';nullable?:boolean;amenity?:boolean;choices?:readonly string[];requiredNew?:boolean;max?:number};
export const importColumns:ImportColumn[]=[
 {key:'property_id',label:'معرّف العقار UUID — للمطابقة فقط',type:'uuid'},
 {key:'property_code',label:'كود العقار الفريد',type:'text',nullable:true,max:100},
 {key:'property_name',label:'اسم العقار',type:'text',requiredNew:true,max:255},
 {key:'property_type',label:'التصنيف العام',type:'choices',choices:['Residential','Commercial','Land'],requiredNew:true},
 {key:'property_kind',label:'نوع العقار',type:'choices',nullable:true,choices:['LAND','APARTMENT','VILLA','FLOOR','BUILDING','SHOWROOM','SHOP','KIOSK','FOOD_TRUCK']},
 {key:'property_use',label:'استخدام العقار',type:'choices',choices:['Residential','Commercial']},
 {key:'building_name',label:'اسم المبنى / المشروع',type:'text',nullable:true,max:180},
 {key:'unit_number',label:'رقم الوحدة',type:'text',nullable:true,max:60},
 {key:'lessor_id',label:'UUID المالك المسجل',type:'uuid',requiredNew:true},
 {key:'ownership_document_id',label:'UUID الصك المسجل',type:'uuid'},
 {key:'document_number',label:'رقم الصك المسجل — بديل UUID',type:'text',max:100},
 {key:'license_number',label:'رقم ترخيص العقار / الإعلان',type:'text',nullable:true,max:100},
 {key:'current_representative_id',label:'UUID الممثل المسجل',type:'uuid',nullable:true},
 {key:'region',label:'المنطقة',type:'text',nullable:true,max:150},{key:'city',label:'المدينة',type:'text',requiredNew:true,max:150},
 {key:'district',label:'الحي',type:'text',nullable:true,max:150},{key:'address',label:'العنوان',type:'text',requiredNew:true,max:1000},
 {key:'latitude',label:'خط العرض',type:'number',nullable:true},{key:'longitude',label:'خط الطول',type:'number',nullable:true},
 {key:'units_count',label:'عدد الوحدات',type:'count',max:100000},
 ...[['rooms','عدد الغرف / غرف النوم'],['lounges','عدد الصالات'],['bathrooms','الحمامات'],['entrances','المداخل']].map(([key,label])=>({key,label,type:'count' as const,nullable:true,max:100})),
 {key:'price',label:'السعر — ريال',type:'number',nullable:true,max:999999999999},
 {key:'media_url',label:'رابط وسائط HTTPS',type:'text',nullable:true,max:2048},
 {key:'map_visible',label:'إظهار العقار على الخريطة الداخلية',type:'boolean'},
 {key:'map_purposes',label:'أغراض الخريطة مفصولة بعلامة |',type:'purposes'},
 {key:'notes',label:'ملاحظات العقار',type:'text',nullable:true,max:2000},
 ...[['master_rooms','غرف الماستر'],['maid_rooms','غرف الخادمة'],['balconies','الشرفات'],['parking_spaces','المواقف']].map(([key,label])=>({key,label,type:'count' as const,nullable:true,amenity:true,max:1000})),
 {key:'area_sqm',label:'المساحة — متر مربع',type:'number',nullable:true,amenity:true,max:100000000},
 {key:'property_age',label:'عمر العقار — سنوات',type:'count',nullable:true,amenity:true,max:500},
 {key:'floor_number',label:'الطابق — سالب للقبو',type:'floor',nullable:true,amenity:true},
 ...[['elevator','مصعد'],['ac','تكييف'],['furnished','مفروش'],['kitchen','مطبخ'],['pool','مسبح'],['garden','حديقة'],['security','حراسة'],['disability_access','تهيئة لذوي الإعاقة']].map(([key,label])=>({key,label,type:'boolean' as const,nullable:true,amenity:true})),
 {key:'orientation',label:'الواجهة / الاتجاه',type:'text',nullable:true,amenity:true,max:100}
];
function fieldSchema(c:ImportColumn):z.ZodTypeAny{
 let s:z.ZodTypeAny;
 if(c.type==='uuid')s=z.string().uuid().transform(v=>v.toLowerCase());
 else if(c.type==='count')s=z.number().int().min(c.key==='units_count'?1:0).max(c.max||100000);
 else if(c.type==='number')s=z.number().finite().min(c.key==='latitude'?-90:c.key==='longitude'?-180:0).max(c.key==='latitude'?90:c.key==='longitude'?180:c.max||1e14);
 else if(c.type==='floor')s=z.number().int().min(-10).max(300);
 else if(c.type==='boolean')s=z.boolean();
 else if(c.type==='choices')s=z.enum(c.choices as [string,...string[]]);
 else if(c.type==='purposes')s=z.array(z.enum(['MANAGEMENT','RENT','SALE'])).max(3).refine(v=>new Set(v).size===v.length);
 else s=z.string().trim().min(1).max(c.max||255);
 if(c.key==='media_url')s=z.string().trim().max(2048).url().refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;});
 return (c.nullable?s.nullable():s).optional();
}
export const amenitiesSchema=z.object(Object.fromEntries(importColumns.filter(c=>c.amenity).map(c=>[c.key,fieldSchema(c)]))).strict();
export const importValuesSchema=z.object(Object.fromEntries(importColumns.map(c=>[c.key,fieldSchema(c)]))).strict().superRefine((v,ctx)=>{
 if(('latitude' in v)!==('longitude' in v)||(v.latitude===null)!==(v.longitude===null))ctx.addIssue({code:'custom',path:['latitude'],message:'أدخل الإحداثيين معاً أو امسحهما معاً'});
});
export type ImportValues=Record<string,string|number|boolean|null|string[]|undefined>;
export type ParsedPropertyRow={source_row:number;values:ImportValues};
export const previewInput=z.object({source_name:z.string().trim().min(1).max(180),sheet_name:z.string().trim().min(1).max(100),rows:z.array(z.object({source_row:z.number().int().min(2).max(10001),values:importValuesSchema}).strict()).min(1).max(500)}).strict().superRefine((p,c)=>{if(new Set(p.rows.map(r=>r.source_row)).size!==p.rows.length)c.addIssue({code:'custom',message:'أرقام صفوف مكررة'});});
export const decisionSchema=z.object({source_row:z.number().int().min(2),action:z.enum(['NEW','UPDATE','SKIP']),target_id:z.string().uuid().optional()}).strict();
export const commitInput=z.object({request_id:z.string().uuid(),decisions:z.array(decisionSchema).min(1).max(500)}).strict();
export function parseSmartWorkbook(book:WorkBook,sheetName:string):ParsedPropertyRow[]{
 const sheet=book.Sheets[sheetName];if(!sheet)throw new Error('اختر ورقة العقارات');
 const ref=sheet['!ref']||'A1';let end=1;const match=ref.match(/(\d+)$/);if(match)end=Number(match[1]);if(end>10001)throw new Error('الورقة تتجاوز10000 صف؛ قسّم الملف');
 const columnName=(n:number)=>{let out='';for(n++;n>0;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
 const headers=new Map<string,string>();for(let c=0;c<200;c++){const cell=sheet[columnName(c)+'1'];if(cell?.f)throw new Error('عناوين الأعمدة لا تقبل المعادلات');const h=String(cell?.v||'').trim();if(!h)continue;const col=importColumns.find(x=>x.key===h||x.label===h);if(!col)throw new Error('عمود غير معروف: '+h);if(headers.has(col.key))throw new Error('عمود مكرر: '+h);headers.set(col.key,columnName(c));}
 if(!headers.size)throw new Error('استخدم قالب كحل؛ عناوين الأعمدة في الصف الأول');
 const rows:ParsedPropertyRow[]=[];
 for(let r=2;r<=end;r++){const values:ImportValues={};for(const c of importColumns){const col=headers.get(c.key);if(!col)continue;const cell=sheet[col+r];if(cell?.f)throw new Error(`الخلية ${col}${r} تحتوي معادلة؛ استبدلها بقيمة ثابتة`);const raw=cell?.v;if(['property_code','document_number','license_number','unit_number'].includes(c.key)&&typeof raw==='number'&&!Number.isSafeInteger(raw))throw new Error(`المعرّف في ${col}${r} فقد دقته؛ استخدم تنسيق نصي وأعد إدخاله`);if(raw===undefined||raw===null||String(raw).trim()==='')continue;let v=normalizeDigits(String(raw)).trim();
  if(v==='__CLEAR__'){if(c.type==='purposes')values[c.key]=[];else if(c.nullable)values[c.key]=null;else throw new Error('لا يمكن مسح '+c.label);continue;}
  if(c.type==='boolean'){if(['true','1','نعم','yes'].includes(v.toLowerCase()))values[c.key]=true;else if(['false','0','لا','no'].includes(v.toLowerCase()))values[c.key]=false;else throw new Error(`قيمة نعم/لا غير صالحة في ${col}${r}`);}
  else if(['number','count','floor'].includes(c.type)){v=v.replace(/[,٬]/g,'').replace('٫','.');if(!/^-?\d+(?:\.\d+)?$/.test(v))throw new Error(`رقم غير صالح في ${col}${r}`);values[c.key]=Number(v);}
  else if(c.type==='purposes')values[c.key]=v.split('|').map(s=>s.trim()).filter(Boolean);
  else {if(/^[=+@]/.test(v)||/^-[^0-9]/.test(v))throw new Error(`نص يشبه معادلة في ${col}${r}`);values[c.key]=v;}
 }
 if(!Object.keys(values).length)continue;const parsed=importValuesSchema.safeParse(values);if(!parsed.success)throw new Error(`راجع الصف ${r}: ${parsed.error.issues.map(x=>x.path.join('.')+' '+x.message).slice(0,3).join(' · ')}`);rows.push({source_row:r,values:parsed.data});if(rows.length>500)throw new Error('الحد الأقصى500 عقار في الدفعة');}
 if(!rows.length)throw new Error('لا توجد عقارات في الملف');return rows;
}
