'use client';
import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

/** History API preserves page/form instances and pathname-scoped drafts. */
export function useRouteTab<T extends string>(fallback: T, allowed: readonly T[]) {
  const signature = allowed.join('|');
  const params = useSearchParams();
  const requested = params.get('tab');
  const tab = requested && signature.split('|').includes(requested) ? requested as T : fallback;
  const select = useCallback((next: T) => {
    if (!signature.split('|').includes(next)) return;
    const url = new URL(window.location.href);
    if (next === fallback) url.searchParams.delete('tab'); else url.searchParams.set('tab', next);
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
  }, [fallback, signature]);
  return [tab, select] as const;
}
