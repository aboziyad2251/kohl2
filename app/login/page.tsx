'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
export default function Login() {
    const [en, setEn] = useState(false), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const router = useRouter(), auth = useAuth();
    const [google, setGoogle] = useState(false);
    useEffect(() => { fetch('/api/auth/providers', {cache:'no-store'}).then(r => r.json()).then(data => setGoogle(data.google === true)).catch(() => {}); }, []);
    return <main dir={en ? 'ltr' : 'rtl'} className="portal-surface min-h-screen grid place-items-center p-4"><form className="portal-card w-full max-w-md space-y-5" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error)
            throw new Error(en ? 'Invalid email or password' : 'البريد أو كلمة المرور غير صحيحة');
        await auth.refresh();
        router.replace('/dashboard');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : 'Sign in failed');
    }
    finally {
        setBusy(false);
    } }}>
  <div className="flex justify-between items-center"><img src="/kohl-icon.png" alt="كحل" width="54" height="54"/><button type="button" onClick={() => setEn(!en)}>{en ? 'العربية' : 'English'}</button></div>
  <h1 className="text-2xl font-bold">{en ? 'Kohl • Sign in' : 'كحل العقارية • تسجيل الدخول'}</h1><p>{en ? 'Sign in with your approved account. Contact Admin or CEO to request access.' : 'سجل الدخول بحسابك المعتمد. تواصل مع المسؤول أو الرئيس التنفيذي لطلب الوصول.'}</p>
  <button type="button" className="portal-input w-full disabled:opacity-50" disabled={busy || !google} onClick={async()=>{setBusy(true);setError('');const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('/auth/callback',window.location.origin).toString(),queryParams:{prompt:'select_account'}}});if(error){setError(en?'Google sign-in failed':'تعذر تسجيل الدخول عبر Google');setBusy(false);}}}>{en?'Sign in with Google':'تسجيل الدخول باستخدام Google'}</button>
  {!google && <p className="text-sm text-gray-500">{en?'Google sign-in is awaiting configuration. Email/password login is available.':'تسجيل Google بانتظار الإعداد. يمكن الدخول بالبريد وكلمة المرور.'}</p>}
  <label className="block">{en ? 'Email' : 'البريد الإلكتروني'}<input className="portal-input" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)}/></label>
  <label className="block">{en ? 'Password' : 'كلمة المرور'}<input className="portal-input" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
  {(error || auth.error) && <p role="alert" className="text-red-700">{error || auth.error}</p>}<button className="portal-button w-full" disabled={busy}>{busy ? '…' : en ? 'Sign in' : 'تسجيل الدخول'}</button>
 </form></main>;
}
