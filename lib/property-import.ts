import { z } from 'zod';
import type { WorkBook, WorkSheet } from 'xlsx';
export const importLimit=500;
export const apartmentSchema=z.object({serial:z.number().int().positive(),source_row:z.number().int().min(1),apartment_number:z.string().trim().min(1).max(60),rooms:z.number().int().min(0).max(100).nullable(),living_rooms:z.number().int().min(0).max(100).nullable(),bathrooms:z.number().int().min(0).max(100).nullable(),entrances:z.number().int().min(0).max(100).nullable(),master_rooms:z.number().int().min(0).max(100).nullable(),maid_rooms:z.number().int().min(0).max(100).nullable(),notes:z.string().max(2000),price_text:z.string().max(300)}).strict();
export type ApartmentRow=z.infer<typeof apartmentSchema>;
export const importSchema=z.object({request_id:z.string().uuid(),property_kind:z.enum(['LAND','APARTMENT','VILLA','FLOOR','BUILDING','SHOWROOM','SHOP','KIOSK','FOOD_TRUCK']).default('APARTMENT'),property_use:z.enum(['Residential','Commercial']).default('Residential'),source_name:z.string().min(1).max(180),sheet_name:z.string().min(1).max(100),building_name:z.string().trim().min(2).max(180),city:z.string().trim().min(1).max(100),address:z.string().trim().min(1).max(1000),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),lessor_id:z.string().uuid(),document_number:z.string().trim().min(1).max(100),issue_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),map_purposes:z.array(z.enum(['MANAGEMENT','RENT','SALE'])).max(3).refine(v=>new Set(v).size===v.length),rows:z.array(apartmentSchema).min(1).max(importLimit)}).strict().superRefine((v,c)=>{if(new Set(v.rows.map(r=>normalizeDigits(r.apartment_number).trim())).size!==v.rows.length)c.addIssue({code:'custom',message:'أرقام الشقق مكررة',path:['rows']});});
export type PropertyImport=z.infer<typeof importSchema>;
export function normalizeDigits(value:string){return value.replace(/[٠-٩۰-۹]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.includes(c)?'٠١٢٣٤٥٦٧٨٩'.indexOf(c):'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));}
function cell(sheet:WorkSheet,col:string,row:number){const c=sheet[`${col}${row}`];if(c?.f)throw new Error(`الخلية ${col}${row} تحتوي معادلة. استبدلها بقيم ثابتة قبل الاستيراد`);return c?.v==null?'':String(c.v).trim();}
function count(value:string,ref:string){if(!value||['—','-'].includes(value))return null;const n=Number(normalizeDigits(value));if(!Number.isInteger(n)||n<0||n>100)throw new Error(`قيمة غير صالحة في ${ref}`);return n;}
export function parsePropertySheet(book:WorkBook,sheetName:string,startRow=5){
 if(!Number.isInteger(startRow)||startRow<2||startRow>10000)throw new Error('حدد صف البداية الصحيح');
 const sheet=book.Sheets[sheetName];if(!sheet)throw new Error('اختر ورقة عمل');
 const rawEnd=sheet['!ref']?.match(/\d+$/)?.[0];const end=Number(rawEnd||startRow);if(end>10000)throw new Error('الورقة طويلة جداً. قسّمها إلى ملفات أصغر');
 const headers:Record<string,string>={};for(const col of 'ABCDEFGHIJ')headers[col]=cell(sheet,col,startRow-1);
 const rows:ApartmentRow[]=[];let skipped=0;
 for(let r=startRow;r<=end;r++){
  const a=sheet[`A${r}`];if(a?.f)throw new Error(`رقم التسلسل في A${r} يجب أن يكون قيمة ثابتة`);
  const serial=normalizeDigits(a?.v==null?'':String(a.v)).trim();
  if(!/^\d+$/.test(serial)){if(serial)skipped++;continue;}
  if(Number(serial)<1)throw new Error(`رقم غير صالح في A${r}`);
  const apartment_number=normalizeDigits(cell(sheet,'B',r));if(!apartment_number)throw new Error(`رقم الشقة مفقود في B${r}`);
  rows.push(apartmentSchema.parse({serial:Number(serial),source_row:r,apartment_number,rooms:count(cell(sheet,'C',r),`C${r}`),living_rooms:count(cell(sheet,'D',r),`D${r}`),bathrooms:count(cell(sheet,'E',r),`E${r}`),entrances:count(cell(sheet,'F',r),`F${r}`),master_rooms:count(cell(sheet,'G',r),`G${r}`),maid_rooms:count(cell(sheet,'H',r),`H${r}`),notes:cell(sheet,'I',r),price_text:cell(sheet,'J',r)}));
  if(rows.length>importLimit)throw new Error(`الحد الأقصى ${importLimit} عقار في الدفعة`);
 }
 if(!rows.length)throw new Error(`لا توجد أرقام عقارات في العمود A بدءاً من A${startRow}`);
 if(new Set(rows.map(r=>r.serial)).size!==rows.length)throw new Error('أرقام التسلسل مكررة. راجع العمود A');
 if(new Set(rows.map(r=>r.apartment_number)).size!==rows.length)throw new Error('أرقام الشقق مكررة. راجع العمود B');
 return {rows,headers,skipped,title:sheet.A1?.v?String(sheet.A1.v).slice(0,180):''};
}
