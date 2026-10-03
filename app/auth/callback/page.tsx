'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabaseClient';
import {portalRequest} from '@/lib/portal/client';
import {useAuth} from '@/context/AuthContext';
import type {PortalProfile} from '@/lib/portal/types';
export default function Callback() {
  const [error,setError]=useState(''); const router=useRouter(),auth=useAuth();
  useEffect(()=>{let cancelled=false;
    void (async()=>{try {
      const params=new URLSearchParams(window.location.search);
      if(params.has('error') || new URLSearchParams(window.location.hash.slice(1)).has('error')) throw new Error('Google sign-in was not completed.');
      const code=params.get('code');
      if(code){const {error}=await supabase.auth.exchangeCodeForSession(code);if(error)throw new Error('Google sign-in could not be verified.');}
      const profile=await portalRequest<PortalProfile>('/api/portal/me');
      if(cancelled)return;
      await auth.refresh();
      router.replace(['OWNER','TENANT','BROKER'].includes(profile.account.role)?'/portal':'/dashboard');
    }catch {if(!cancelled){await supabase.auth.signOut();setError('هذا الحساب غير معتمد أو تعذر تسجيل الدخول. تواصل مع المسؤول. / Account not approved or sign-in failed. Contact your administrator.');}}
    })();return()=>{cancelled=true;};
  },[auth.refresh,router]);
  return <main className="portal-surface min-h-screen grid place-items-center p-4"><div className="portal-card max-w-md">{error?<><p role="alert">{error}</p><a href="/login">العودة لتسجيل الدخول / Back to login</a></>:<p>جارٍ التحقق من الحساب… / Verifying account…</p>}</div></main>;
}
