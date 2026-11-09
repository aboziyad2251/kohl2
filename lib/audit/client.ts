'use client';
import { portalRequest } from '@/lib/portal/client';
let auditedPrinting=false,auditedExporting=false;
export function nativeDownloadIsAudited(){return auditedExporting;}
export function nativePrintIsAudited(){return auditedPrinting;}
export async function logExport(filename:string,recordId?:string){
 try{await portalRequest('/api/audit/export',{method:'POST',body:JSON.stringify({filename:filename.slice(0,180),record_id:recordId||null,path:window.location.pathname})});return true;}
 catch{console.warn('[audit] export request could not be recorded');return false;}
}
export async function runAuditedExport(filename:string,operation:()=>void,recordId?:string){
 if(!await logExport(filename,recordId)){window.alert('تعذر تسجيل التصدير. لم يتم إخراج الملف؛ أعد المحاولة عند عودة الاتصال.');return false;}
 auditedExporting=true;try{operation();return true;}catch{window.alert('تعذر إخراج الملف أو فتح الطباعة؛ أعد المحاولة.');return false;}finally{auditedExporting=false;}
}
export async function auditedPrint(recordId?:string,print:()=>void=()=>window.print()){
 return runAuditedExport('print.pdf',()=>{auditedPrinting=true;try{print();}finally{auditedPrinting=false;}},recordId);
}
