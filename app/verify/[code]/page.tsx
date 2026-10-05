'use client';
import { useEffect,useState } from 'react';
export default function Verify({params}:{params:{code:string}}){
 const [document,setDocument]=useState<{kind:string;created_at:string}|null>(null),[done,setDone]=useState(false);
 useEffect(()=>{fetch(`/api/documents/verify/${encodeURIComponent(params.code)}`).then(async r=>{if(r.ok)setDocument(await r.json());}).finally(()=>setDone(true));},[params.code]);
 return <main className="portal-surface min-h-screen p-6 w-full"><section className="portal-card max-w-xl mx-auto mt-12"><img src="/kohl-icon.png" width={64} height={64} alt="كحل العقارية"/><h1 className="text-2xl font-bold mt-4">التحقق من وثيقة كحل | Document verification</h1><p className="mt-4">{!done?'جارٍ التحقق…':document?'رمز الوثيقة صحيح | Valid document code':'الوثيقة غير موجودة | Document not found'}</p>{document&&<><p>{document.kind==='payment'?'إثبات دفع | Payment proof':'كشف مالك | Owner statement'}</p><p dir="ltr">{document.created_at}</p><p className="mt-4 text-sm">حفاظاً على الخصوصية لا تعرض بيانات العميل أو المبالغ هنا.</p></>}</section></main>;
}
