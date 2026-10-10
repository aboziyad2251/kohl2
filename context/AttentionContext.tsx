'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { portalRequest } from '@/lib/portal/client';
import type { AttentionSummary } from '@/lib/portal/attention';
interface AttentionState { data: AttentionSummary | null; error: string; loading: boolean; updatedAt: Date | null; refresh: () => Promise<void>; }
const AttentionContext = createContext<AttentionState | null>(null);
export function AttentionProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<AttentionSummary | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const controller = useRef<AbortController | null>(null);
    const refresh = useCallback(async () => {
        controller.current?.abort();
        const request = new AbortController(); controller.current = request;
        setLoading(true);
        try {
            const result = await portalRequest<AttentionSummary>('/api/portal/attention', { signal: request.signal });
            if (!request.signal.aborted) { setData(result); setError(''); setUpdatedAt(new Date()); }
        } catch (e) {
            if (!request.signal.aborted) { setData(null); setError('تعذر تحديث التنبيهات. أعد المحاولة. / Unable to refresh alerts. Please retry.'); }
        } finally { if (!request.signal.aborted) setLoading(false); }
    }, []);
    useEffect(() => {
        void refresh();
        const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
        const timer = setInterval(visible, 60000);
        document.addEventListener('visibilitychange', visible);
        window.addEventListener('focus', visible);
        return () => { clearInterval(timer); controller.current?.abort(); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible); };
    }, [refresh]);
    return <AttentionContext.Provider value={{ data, error, loading, updatedAt, refresh }}>{children}</AttentionContext.Provider>;
}
export const useAttention = () => useContext(AttentionContext);
