import { supabase } from '@/lib/supabaseClient';
export async function portalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { data } = await supabase.auth.getSession();
    if (!data.session)
        throw new Error('يرجى تسجيل الدخول / Please sign in');
    const response = await fetch(path, { ...init, cache: 'no-store', headers: {
            ...init.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`,
        } });
    const body = await response.json();
    if (!response.ok)
        throw new Error(body.error || 'تعذر تنفيذ الطلب / Request failed');
    return body as T;
}
