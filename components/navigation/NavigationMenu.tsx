'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, Search, Star, X } from 'lucide-react';
import { navGroups, navItems, navShortcuts, routeItem, searchNavigation, isNavigationItemActive, type NavItem } from '@/lib/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNavigation } from '@/context/NavigationContext';
import NavIcon from './NavIcon';

export default function NavigationMenu({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const { canAccess } = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();
  const { preferences, toggleFavorite, toggleGroup } = useNavigation();
  const [query, setQuery] = useState('');
  const current = routeItem(pathname);
  const results = searchNavigation(query, canAccess);
  const favorites = preferences.favorites.map(id => [...navItems, ...navShortcuts].find(item => item.id === id)).filter((item): item is NavItem => !!item && canAccess(item.moduleKey));
  function row(item: NavItem, favoriteSection = false) {
    const active = isNavigationItemActive(item, pathname, params.toString());
    const favorite = preferences.favorites.includes(item.id);
    return <div className="kohl-nav-row" key={item.id}>
      <Link href={item.href} onClick={onNavigate} aria-current={active && !favoriteSection ? 'page' : undefined} data-selected={active || undefined} title={item.title}>
        <NavIcon name={item.icon} /><span>{item.label}</span>
      </Link>
      <button type="button" className="kohl-favorite-button" aria-label={`${favorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}: ${item.label}`} aria-pressed={favorite} onClick={() => toggleFavorite(item.id)}><Star size={15} fill={favorite ? 'currentColor' : 'none'} /></button>
    </div>;
  }
  return <nav aria-label="أقسام المكتب" className="kohl-section-nav kohl-grouped-nav">
    <div className="kohl-nav-search"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث عن قسم أو خدمة…" aria-label="بحث الأقسام والخدمات" />{query && <button type="button" className="kohl-search-clear" aria-label="مسح بحث الأقسام" onClick={() => setQuery('')}><X size={15} /></button>}</div>
    {query.trim() ? <section className="kohl-nav-group" aria-label="نتائج البحث"><h2>نتائج البحث <span className="kohl-group-count" role="status">{results.length}</span></h2><div className="kohl-nav-links">{results.map(item => row(item))}</div>{!results.length && <p className="kohl-nav-empty" role="status">لا توجد أقسام مطابقة.</p>}</section> : <>
      {!!favorites.length && <section className="kohl-nav-group" aria-label="المفضلة"><h2><Star size={14} /> المفضلة <span className="kohl-group-count" aria-hidden="true">{favorites.length}</span></h2><div className="kohl-nav-links">{favorites.map(item => row(item, true))}</div></section>}
      {navGroups.map(group => {
        const items = navItems.filter(item => item.group === group.id && canAccess(item.moduleKey));
        if (!items.length) return null;
        const expanded = mobile || current?.group === group.id || !preferences.collapsed.includes(group.id);
        const panelId = `${mobile ? 'mobile' : 'desktop'}-nav-${group.id}`;
        return <section className="kohl-nav-group" key={group.id} aria-label={group.label}>
          <h2>{mobile ? <><span>{group.label}</span><span className="kohl-group-count" aria-hidden="true">{items.length}</span></> : <button type="button" aria-label={group.label} aria-expanded={expanded} aria-controls={panelId} onClick={() => toggleGroup(group.id)} disabled={current?.group === group.id}><span>{group.label}</span><span className="kohl-group-count" aria-hidden="true">{items.length}</span>{current?.group !== group.id && <ChevronDown size={14} className={expanded ? '' : 'kohl-group-closed'} />}</button>}</h2>
          <div id={panelId} className="kohl-nav-links" hidden={!expanded}>{items.map(item => row(item))}</div>
        </section>;
      })}
    </>}
  </nav>;
}
