'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { portalRequest } from '@/lib/portal/client';
export default function SetPassword() {
    const [en, setEn] = useState(false), [ready, setReady] = useState(false), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [checking, setChecking] = useState(true), [saved, setSaved] = useState(false);
    const initialization = useRef<Promise<void> | null>(null);
    useEffect(() => {
        let alive = true;
        // A one-time recovery code must not be exchanged twice by Strict Mode.
        // Cache failures too, so clearing the URL cannot validate another session.
        if (!initialization.current) initialization.current = (async () => {
            try {
                const url = new URL(window.location.href);
                if (url.searchParams.has('error') || url.hash.includes('error=')) throw new Error();
                // The SDK may already be redeeming the initial URL. Wait for
                // it and propagate its error instead of reusing an old session.
                const { error: initializationError } = await supabase.auth.initialize();
                if (initializationError) throw new Error();
                const code = url.searchParams.get('code');
                if (code && new URL(window.location.href).searchParams.get('code') === code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw new Error();
                }
                const { data, error } = await supabase.auth.getSession();
                if (error || !data.session) throw new Error();
                await portalRequest('/api/portal/me');
            } finally { window.history.replaceState({}, '', window.location.pathname); }
        })();
        void initialization.current.then(() => { if (alive) setReady(true); }).catch(() => {
            if (alive) setError('سجل الدخول بحسابك المعتمد أو افتح رابط استعادة صالح. / Sign in with your approved account or open a valid recovery link.');
        }).finally(() => { if (alive) setChecking(false); });
        const { data } = supabase.auth.onAuthStateChange(event => { if (alive && event === 'SIGNED_OUT') setReady(false); });
        return () => { alive = false; data.subscription.unsubscribe(); };
    }, []);
    return <main dir={en ? 'ltr' : 'rtl'} className="portal-surface min-h-screen grid place-items-center p-4"><form className="portal-card max-w-md w-full space-y-5" onSubmit={async (e) => { e.preventDefault(); if (!ready || busy || saved) return; setError(''); if (password.length < 12 || password.length > 128) { setError('استخدم من 12 إلى 128 خانة / Use 12–128 characters'); return; } if (password !== confirmation) {
        setError('كلمتا المرور غير متطابقتين / Passwords do not match');
        return;
    } setBusy(true); try {
        await portalRequest('/api/portal/me'); const { error } = await supabase.auth.updateUser({ password }); if (error) throw new Error();
        setPassword(''); setConfirmation(''); setReady(false); setSaved(true); await supabase.auth.signOut();
    } catch { setError('تعذر تعيين كلمة المرور. تحقق من الجلسة أو سجل الدخول مجدداً. / Unable to set password. Check your session or sign in again.'); }
    finally { setBusy(false); } }}>
  <div className="flex justify-between"><h1 className="text-xl font-bold">{en ? 'Set or change password' : 'تعيين أو تغيير كلمة المرور'}</h1><button type="button" onClick={() => setEn(!en)}>{en ? 'العربية' : 'English'}</button></div>
  <p>{en ? 'For your current account only. Choose 12–128 characters. You can also set a password after signing in with Google.' : 'لحسابك الحالي فقط. اختر من 12 إلى 128 خانة. يمكنك أيضاً تعيين كلمة مرور بعد الدخول باستخدام Google.'}</p>
  {checking && <p role="status">{en ? 'Checking your account…' : 'جارٍ التحقق من حسابك…'}</p>}
  {saved && <p role="status">{en ? 'Password saved. Sign in again with your new password or Google.' : 'تم حفظ كلمة المرور. سجل الدخول مجدداً بكلمة المرور الجديدة أو Google.'}</p>}
  {ready && !saved && <>
  <label className="block">{en ? 'New password' : 'كلمة المرور الجديدة'}<input className="portal-input" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)}/></label>
  <label className="block">{en ? 'Confirm password' : 'تأكيد كلمة المرور'}<input className="portal-input" type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>
  <button className="portal-button w-full" disabled={busy}>{busy ? en ? 'Saving…' : 'جارٍ الحفظ…' : en ? 'Save password' : 'حفظ كلمة المرور'}</button></>}
  {error && <p role="alert" className="text-red-700">{error}</p>}
  <a className="block underline" href={ready ? '/dashboard' : '/login'}>{ready ? en ? 'Back to my account' : 'العودة إلى حسابي' : en ? 'Back to login' : 'العودة لتسجيل الدخول'}</a>
 </form></main>;
}
