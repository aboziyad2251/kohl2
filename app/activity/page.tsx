'use client';
import { useState } from 'react';
import Link from 'next/link';
import { activitySources, riyadhDay, type ActivityData } from '@/lib/navigation/workspace';
import { normalizeSearch } from '@/lib/navigation';
import { useWorkspaceData } from '@/components/navigation/useWorkspaceData';
import WorkspaceState from '@/components/navigation/WorkspaceState';
export default function ActivityPage() {
  const { data, loading, error, refresh } = useWorkspaceData<ActivityData>('/api/workspace/activity');
  const [source, setSource] = useState('all'), [query, setQuery] = useState(''), [count, setCount] = useState(30);
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const events = (data?.events || []).filter(event => (source === 'all' || event.source === source) && normalizeSearch(`${event.action} ${event.actor}`).includes(normalizeSearch(query)) && (!from || riyadhDay(new Date(event.date)) >= from) && (!to || riyadhDay(new Date(event.date)) <= to));
  return <div className="workspace-page" dir="rtl"><div className="workspace-heading"><div><h1>سجل النشاط</h1><p>أحدث 100 سجل من كل مصدر. تحتفظ كل عملية بمصدرها وقد تظهر في أكثر من سجل.</p></div><button type="button" disabled={loading} onClick={refresh}>تحديث</button></div>
    <div className="workspace-toolbar"><label>بحث<input type="search" value={query} onChange={event => { setQuery(event.target.value); setCount(30); }} placeholder="عملية أو مستخدم…" /></label><label>المصدر<select value={source} onChange={event => { setSource(event.target.value); setCount(30); }}><option value="all">كل المصادر</option>{Object.entries(activitySources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>من<input type="date" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setCount(30); }} /></label><label>إلى<input type="date" min={from || undefined} value={to} onChange={event => { setTo(event.target.value); setCount(30); }} /></label></div>
    <WorkspaceState loading={loading} error={error} warnings={data?.warnings} refresh={refresh} />
    <section className="workspace-card"><h2>العمليات <span className="workspace-count">{events.length}</span></h2>
      {!loading && !error && data && !events.length && <p className="workspace-empty">لا توجد عمليات مطابقة ضمن السجلات المتاحة.</p>}
      <ul className="workspace-event-list">{events.slice(0, count).map(event => <li key={event.id}><time dateTime={event.date}>{new Date(event.date).toLocaleString('ar-SA', { calendar: 'gregory', timeZone: 'Asia/Riyadh' })}</time><div><strong>{event.action}</strong><p>{activitySources[event.source]} · {event.actor}</p></div><Link href={event.href}>السجل الأصلي ←</Link></li>)}</ul>
      {events.length > count && <button className="workspace-more" type="button" onClick={() => setCount(value => value + 30)}>عرض المزيد</button>}
    </section>
  </div>;
}
