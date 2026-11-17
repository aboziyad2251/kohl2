'use client';
import { useState } from 'react';

// Deliberately has no recovery form or Auth recovery call. A stale provider flag
// must never re-enable email recovery in this template.
export default function ForgotPassword() {
    const [en, setEn] = useState(false);
    return <main dir={en ? 'ltr' : 'rtl'} className="portal-surface min-h-screen grid place-items-center p-4">
        <section className="portal-card max-w-md w-full space-y-5">
            <div className="flex justify-between items-center gap-3">
                <h1 className="text-xl font-bold">{en ? 'Password recovery' : 'استعادة كلمة المرور'}</h1>
                <button type="button" onClick={() => setEn(!en)}>{en ? 'العربية' : 'English'}</button>
            </div>
            <div role="status">
                <p lang="en" dir="ltr">Email password recovery is currently unavailable</p>
                {!en && <p lang="ar">استعادة كلمة المرور بالبريد غير متاحة حالياً.</p>}
            </div>
            <p>{en ? 'Contact your administrator to reset your password.' : 'تواصل مع المسؤول لإعادة تعيين كلمة المرور.'}</p>
            <a className="block underline" href="/login">{en ? 'Back to login' : 'العودة لتسجيل الدخول'}</a>
        </section>
    </main>;
}
