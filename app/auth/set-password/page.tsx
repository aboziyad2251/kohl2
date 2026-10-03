'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
export default function SetPassword() {
    const [en, setEn] = useState(false), [ready, setReady] = useState(false), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const router = useRouter();
    useEffect(() => { let alive = true; const init = async () => { const code = new URL(window.location.href).searchParams.get('code'); if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && alive)
            setError('الرابط غير صالح أو منتهي / Invalid or expired link');
    } const { data } = await supabase.auth.getSession(); if (alive)
        setReady(!!data.session); window.history.replaceState({}, '', window.location.pathname); }; void init(); const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (alive)
        setReady(!!session); }); return () => { alive = false; data.subscription.unsubscribe(); }; }, []);
    return <main dir={en ? 'ltr' : 'rtl'} className="portal-surface min-h-screen grid place-items-center p-4"><form className="portal-card max-w-md w-full space-y-5" onSubmit={async (e) => { e.preventDefault(); setError(''); if (password !== confirmation) {
        setError('كلمتا المرور غير متطابقتين / Passwords do not match');
        return;
    } setBusy(true); const { error } = await supabase.auth.updateUser({ password }); setBusy(false); if (error)
        setError('تعذر تعيين كلمة المرور / Unable to set password');
    else {
        await supabase.auth.signOut();
        router.replace('/login');
    } }}>
  <div className="flex justify-between"><h1 className="text-xl font-bold">{en ? 'Set password' : 'تعيين كلمة المرور'}</h1><button type="button" onClick={() => setEn(!en)}>{en ? 'العربية' : 'English'}</button></div><p>{en ? 'Choose at least 12 characters.' : 'اختر كلمة مرور من 12 خانة على الأقل.'}</p>
  <label className="block">{en ? 'New password' : 'كلمة المرور الجديدة'}<input className="portal-input" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)}/></label>
  <label className="block">{en ? 'Confirm password' : 'تأكيد كلمة المرور'}<input className="portal-input" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>
  {!ready && <p>{en ? 'Open your invitation or reset link to continue.' : 'افتح رابط الدعوة أو إعادة التعيين للمتابعة.'}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}<button className="portal-button w-full" disabled={!ready || busy}>{en ? 'Save password' : 'حفظ كلمة المرور'}</button>
 </form></main>;
}
