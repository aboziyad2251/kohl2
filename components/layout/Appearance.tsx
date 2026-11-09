'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Palette, Check } from 'lucide-react';

type Appearance = 'light' | 'black' | 'blue';
const modes: { value: Appearance; label: string }[] = [
  { value: 'black', label: 'أسود داكن' },
  { value: 'blue', label: 'أزرق داكن' },
  { value: 'light', label: 'فاتح · الافتراضي' },
];
const storageKey = 'kohl.appearance';
const AppearanceContext = createContext({ appearance: 'light' as Appearance, change: (_value: Appearance) => {} });

export function AppearanceWorkspace({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>('light');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (modes.some(mode => mode.value === saved)) setAppearance(saved as Appearance);
    } catch { /* Appearance remains usable when browser storage is disabled. */ }
  }, []);
  function change(value: Appearance) {
    setAppearance(value);
    try { localStorage.setItem(storageKey, value); } catch { /* Session-only preference. */ }
  }
  return <AppearanceContext.Provider value={{ appearance, change }}>
    <div data-appearance={appearance} className="kohl-workspace flex w-full min-h-screen">{children}</div>
  </AppearanceContext.Provider>;
}

export function AppearanceSwitch() {
  const { appearance, change } = useContext(AppearanceContext);
  return <details className="appearance-switch" onKeyDown={event => {
    if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
  }}>
    <summary aria-label="تغيير مظهر مساحة العمل" title="تغيير المظهر">
      <Palette size={16} /><span className="hidden sm:inline">المظهر</span>
    </summary>
    <div className="appearance-options" aria-label="أنماط المظهر">
      {modes.map(mode => <button key={mode.value} type="button" aria-pressed={appearance === mode.value} onClick={event => {
        change(mode.value);
        const details = event.currentTarget.closest('details');
        if (details) { details.open = false; details.querySelector('summary')?.focus(); }
      }}><span className={`appearance-swatch appearance-swatch-${mode.value}`} />{mode.label}{appearance === mode.value && <Check size={15} />}</button>)}
    </div>
  </details>;
}
