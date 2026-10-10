'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
export default function ForgotPassword() {
    const [en, setEn] = useState(false), [email, setEmail] = useState(''), [enabled, setEnabled] = useState<boolean | null>(null), [google, setGoogle] = useState(false), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('');
    const t = (ar: string, english: string) => en ? english : ar;
    useEffect(() => {
        const controller = new AbortController();
        fetch('/api/auth/providers', { cache: 'no-store', signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { setEnabled(data.recovery === true); setGoogle(data.google === true); }).catch(() => { if (!controller.signal.aborted) setEnabled(false); });
        return () => controller.abort();
    }, []);
    return <main dir={en ? 'ltr' : 'rtl'} className="portal-surface min-h-screen grid place-items-center p-4"><section className="portal-card max-w-md w-full space-y-5">
        <div className="flex justify-between items-center gap-3"><h1 className="text-xl font-bold">{t('استعادة كلمة المرور', 'Password recovery')}</h1><button type="button" onClick={() => setEn(!en)}>{en ? 'العربية' : 'English'}</button></div>
        {enabled === null ? <p role="status">{t('جارٍ التحقق…', 'Checking availability…')}</p> : !enabled ? <p role="status">{google ? t('استعادة كلمة المرور بالبريد غير متاحة حالياً. يمكنك الدخول باستخدام Google إذا كان بريدك معتمداً، أو التواصل مع المسؤول لإعادة تعيين كلمة المرور.', 'Email password recovery is currently unavailable. Sign in with Google using your approved email, or contact your administrator to reset your password.') : t('استعادة كلمة المرور بالبريد غير متاحة حالياً. تواصل مع المسؤول لإعادة تعيين كلمة المرور.', 'Email password recovery is currently unavailable. Contact your administrator to reset your password.')}</p> : sent ? <p role="status">{t('إذا كان هذا البريد مسجلاً، فستصلك رسالة لاستعادة كلمة المرور. تحقق من الوارد والبريد غير المرغوب فيه.', 'If this email is registered, you will receive a password recovery email. Check your inbox and spam folder.')}</p> : <form className="space-y-4" onSubmit={async event => {
            event.preventDefault(); if (busy) return; setBusy(true); setError('');
            try {
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: new URL('/auth/set-password', window.location.origin).toString() });
                if (error) throw new Error(); setSent(true);
            } catch { setError(t('تعذر إرسال الطلب. حاول لاحقاً أو تواصل مع المسؤول.', 'Unable to send the request. Try later or contact your administrator.')); }
            finally { setBusy(false); }
        }}><p>{t('أدخل البريد المستخدم لحسابك المعتمد.', 'Enter the email used for your approved account.')}</p><label className="block">{t('البريد الإلكتروني', 'Email')}<input className="portal-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label>{error && <p role="alert">{error}</p>}<button className="portal-button w-full" disabled={busy}>{busy ? t('جارٍ الإرسال…', 'Sending…') : t('إرسال رابط الاستعادة', 'Send recovery link')}</button></form>}
        <Link className="block underline" href="/login">{t('العودة لتسجيل الدخول', 'Back to login')}</Link>
    </section></main>;
}
