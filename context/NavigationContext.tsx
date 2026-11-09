'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { emptyPreferences, parsePreferences, preferenceKey, type NavigationPreferences } from '@/lib/navigation/preferences';

const Context = createContext<{ preferences: NavigationPreferences; toggleFavorite: (id: string) => void; toggleGroup: (id: string) => void; reset: () => void } | null>(null);
export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const key = preferenceKey(currentUser.id);
  const [state, setState] = useState<{ key: string; value: NavigationPreferences }>({ key: '', value: emptyPreferences });
  useEffect(() => {
    const read = () => { try { setState({ key, value: parsePreferences(localStorage.getItem(key)) }); } catch { setState({ key, value: emptyPreferences }); } };
    read();
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);
  const preferences = state.key === key ? state.value : emptyPreferences;
  const update = useCallback((change: (value: NavigationPreferences) => NavigationPreferences) => {
    setState(old => {
      const next = parsePreferences(JSON.stringify(change(old.key === key ? old.value : emptyPreferences)));
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Session-only preferences when storage is unavailable. */ }
      return { key, value: next };
    });
  }, [key]);
  const toggle = (field: 'favorites' | 'collapsed', id: string) => update(old => ({ ...old, [field]: old[field].includes(id) ? old[field].filter(value => value !== id) : [...old[field], id] }));
  return <Context.Provider value={{ preferences, toggleFavorite: id => toggle('favorites', id), toggleGroup: id => toggle('collapsed', id), reset: () => update(() => emptyPreferences) }}>{children}</Context.Provider>;
}
export function useNavigation() { const value = useContext(Context); if (!value) throw new Error('NavigationProvider required'); return value; }
