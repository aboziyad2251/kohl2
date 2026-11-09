import { NextRequest,NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { importActor,importContext } from '@/lib/properties/import-server';
import { importColumns } from '@/lib/properties/import-model';
import { apiError } from '@/lib/portal/server';
import { withAudit,recordAudit } from '@/lib/audit/server';
export const dynamic='force-dynamic';
async function get(req:NextRequest){try{const {user}=await importActor(req),context=await importContext(user.id),book=XLSX.utils.book_new();
 const sheet=XLSX.utils.aoa_to_sheet([importColumns.map(c=>c.key)]);for(let r=1;r<=500;r++)importColumns.forEach((c,index)=>{if(c.type==='uuid'||c.type==='text')sheet[XLSX.utils.encode_cell({r,c:index})]={t:'s',v:'',z:'@'};});sheet['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:500,c:importColumns.length-1}});sheet['!cols']=importColumns.map(()=>({wch:23}));XLSX.utils.book_append_sheet(book,sheet,'Properties');
 const help=XLSX.utils.aoa_to_sheet([['Column','العنوان','Type','Required for NEW','Values / notes'],...importColumns.map(c=>[c.key,c.label,c.type,c.requiredNew?'نعم':'لا',c.choices?.join(' | ')||(c.nullable?'__CLEAR__ للمسح؛ الفراغ يبقي الحالي':'الفراغ يبقي الحالي')]),[],['تعليمات','عقار جديد: اسم وتصنيف ومدينة وعنوان ومالك مسجل. المعرّف للمطابقة فقط.'],['التحديث','المعاينة إلزامية. لا تستخدم رقم الصك المشترك لتخمين الوحدة.'],['المزايا','0 ولا قيم فعلية؛ الفراغ ليس صفراً.'],['الأمان','لا تضع معادلات. انقل الملكية أو الممثل من الإجراء الحالي.']]);help['!cols']=[{wch:30},{wch:45},{wch:15},{wch:20},{wch:80}];XLSX.utils.book_append_sheet(book,help,'Instructions');
 const safe=(v:string)=>/^[=+@-]/.test(v)?"'"+v:v;
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['lessor_id','name'],...context.owners.map(o=>[o.id,safe(o.name)])]),'Owners');
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['ownership_document_id','document_number','lessor_id'],...context.documents.map(d=>[d.id,safe(d.document_number),d.lessor_id])]),'Deeds');
 XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['current_representative_id','name'],...context.representatives.map(r=>[r.id,safe(r.name)])]),'Representatives');
 await recordAudit('EXPORT','Properties',{source:'property_template',outcome:'GENERATED',columns:importColumns.length});
 return new NextResponse(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="Kohl-Properties-Template.xlsx"','Cache-Control':'no-store'}});
 }catch(e){return apiError(e);}}
export const GET=withAudit(get);
