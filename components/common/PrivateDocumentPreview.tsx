'use client';
import {useEffect,useState} from 'react';
import {operationsFetch} from '@/lib/operations/client';
/** Fetch through the same authenticated download API; never publish a Storage URL. */
export default function PrivateDocumentPreview({path,filename}:{path:string;filename:string}){
 const [url,setUrl]=useState(''),[mime,setMime]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  const controller=new AbortController();let objectUrl='';let active=true;
  setUrl('');setError('');setMime('');
  void (async()=>{
   try{
    const response=await operationsFetch(path,{signal:controller.signal});
    const blob=await response.blob();
    if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(blob.type))throw new Error('نوع المستند لا يدعم المعاينة. استخدم التنزيل.');
    if(!active)return;
    objectUrl=URL.createObjectURL(blob);setMime(blob.type);setUrl(objectUrl);
   }catch(e){if(active)setError(e instanceof Error?e.message:'تعذر تحميل المعاينة');}
  })();
  return()=>{active=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[path]);
 if(error)return <p role="alert">{error}</p>;
 if(!url)return <p role="status">جارٍ تحميل المعاينة الخاصة…</p>;
 return <div className="space-y-2" aria-label={'معاينة '+filename}>
  {mime==='application/pdf'?<iframe title={'معاينة '+filename} src={url} sandbox="allow-same-origin" className="w-full h-[65vh] min-h-[320px] border rounded"/>:
   // eslint-disable-next-line @next/next/no-img-element
   <img src={url} alt={filename} className="max-w-full max-h-[65vh] object-contain"/>}
  <p>إذا لم يدعم جهازك العرض، يمكنك تنزيل المستند من زر التنزيل.</p>
 </div>;
}
