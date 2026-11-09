'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { navGroups, searchNavigation } from '@/lib/navigation';
import { useAuth } from '@/context/AuthContext';
import NavIcon from './NavIcon';

export default function NavigationSearch() {
  const { canAccess } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const results = searchNavigation(query, canAccess);
  function open() { setQuery(''); dialog.current?.showModal(); input.current?.focus(); }
  function close() { dialog.current?.close(); trigger.current?.focus(); }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (dialog.current?.open) dialog.current.close(); else open(); } };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  return <>
    <button ref={trigger} type="button" onClick={open} className="kohl-search-trigger" aria-label="بحث الأقسام والخدمات" title="بحث الأقسام (Ctrl+K)"><Search size={18} /><span>بحث الأقسام</span><kbd>⌘/Ctrl K</kbd></button>
    <dialog ref={dialog} className="kohl-search-dialog" aria-label="بحث الأقسام والخدمات" onClick={event => { if (event.currentTarget === event.target) close(); }}>
      <div className="kohl-search-panel" dir="rtl"><div className="kohl-search-heading"><h2>إلى أين تريد الانتقال؟</h2><button type="button" onClick={close} aria-label="إغلاق البحث"><X size={20} /></button></div>
        <label className="kohl-nav-search"><Search size={18} /><input ref={input} type="search" placeholder="قسم، خدمة، أو متابعة…" aria-label="ابحث عن قسم أو خدمة" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); dialog.current?.querySelector<HTMLAnchorElement>('.kohl-search-results a')?.focus(); }
          if (event.key === 'Enter') { event.preventDefault(); dialog.current?.querySelector<HTMLAnchorElement>('.kohl-search-results a')?.click(); }
        }} /></label>
        <div className="kohl-search-results" onKeyDown={event => {
          if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
          const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a'));
          const index = links.indexOf(document.activeElement as HTMLAnchorElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1);
          event.preventDefault(); if (next < 0) input.current?.focus(); else links[Math.min(next, links.length - 1)]?.focus();
        }}>{results.map(item => <Link key={item.id} href={item.href} onClick={close}><NavIcon name={item.icon} /><span className="kohl-search-result-label"><strong>{item.label}</strong><small>{navGroups.find(group => group.id === item.group)?.label} · {item.href.includes('?') ? 'اختصار خدمة' : 'قسم'}</small></span></Link>)}</div>
        {!results.length && <p role="status" className="kohl-nav-empty">لا توجد أقسام مطابقة. جرّب كلمة أخرى.</p>}
        <p className="kohl-search-hint" role="status">{results.length} نتيجة · الأقسام والخدمات المتاحة لحسابك · ↑ ↓ للتنقل · Esc للإغلاق</p>
      </div>
    </dialog>
  </>;
}
