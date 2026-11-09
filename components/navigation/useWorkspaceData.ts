'use client';
import { useCallback, useEffect, useState } from 'react';
import { portalRequest } from '@/lib/portal/client';
export function useWorkspaceData<T>(path: string) {
  const [state, setState] = useState<{ path: string; data: T | null; error: string; loading: boolean }>({ path, data: null, error: '', loading: true });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ path, data: null, error: '', loading: true });
    portalRequest<T>(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ path, data, error: '', loading: false });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ path, data: null, error: 'تعذر تحميل البيانات. تحقق من الاتصال وأعد المحاولة.', loading: false });
    });
    return () => controller.abort();
  }, [path, version]);
  return { ...(state.path === path ? state : { data: null, error: '', loading: true }), refresh };
}
