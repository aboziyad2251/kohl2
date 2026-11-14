'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { portalRequest } from '@/lib/portal/client';
export default function LeasingSwitcher() {
  const {currentUser}=useAuth();
  const [choice,setChoice]=useState<{direction:'ENTER'|'RETURN';name:string}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let active=true;setChoice(null);
    if(['ADMIN','LEASING'].includes(currentUser.role))
      portalRequest<{direction:'ENTER'|'RETURN';name:string}>('/api/auth/leasing-switch')
        .then(v=>{if(active)setChoice(v);}).catch(()=>{});
    return ()=>{active=false;};
  },[currentUser.id,currentUser.role]);
  async function switchAccount() {
    if(!choice || busy)return;setBusy(true);setError('');
    try {
      const {data}=await supabase.auth.getSession();
      if(!data.session)throw new Error('سجّل الدخول مجدداً.');
      const result=await portalRequest<{session:{access_token:string;refresh_token:string};destination:string}>('/api/auth/leasing-switch',{
        method:'POST',body:JSON.stringify({operation:choice.direction,...(choice.direction==='ENTER'?{refresh_token:data.session.refresh_token}:{})})});
      const {error}=await supabase.auth.setSession(result.session);
      if(error)throw new Error('تعذر فتح الحساب؛ سجّل الدخول مجدداً.');
      // Remove legacy unscoped caches. A full navigation drops all in-memory admin data.
      Object.keys(localStorage).filter(k=>k.startsWith('kohl_')).forEach(k=>localStorage.removeItem(k));
      window.location.replace(result.destination);
    }catch(e){setError(e instanceof Error?e.message:'تعذر تبديل الحساب.');setBusy(false);}
  }
  if(!choice) return currentUser.role==='LEASING'?<p className="px-3 text-xs text-slate-400">للعودة إذا انتهت الجلسة: سجّل الخروج ثم ادخل بحساب محمد.</p>:null;
  return <div className="border-t border-slate-700 p-3 space-y-2">
    <button type="button" disabled={busy} onClick={()=>void switchAccount()} className="w-full rounded-lg p-2 bg-sky-600 text-white text-sm disabled:opacity-50">
      {busy?'جارٍ تبديل الحساب…':choice.direction==='ENTER'?`التبديل إلى ${choice.name}`:`العودة إلى ${choice.name}`}
    </button>
    <p className="text-xs text-slate-400">{choice.direction==='ENTER'?'طلبات ومتابعات التأجير فقط، دون الإدارة أو المالية. احفظ النموذج المفتوح قبل التبديل.':'أنت الآن تعمل بصلاحيات أخصائي التأجير فقط.'}</p>
    {error&&<p role="alert" className="text-xs text-red-400">{error}</p>}
  </div>;
}
