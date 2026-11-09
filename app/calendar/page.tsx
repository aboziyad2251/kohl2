'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { calendarSources, availableCalendarSources, calendarStatusLabel, monthRange, shiftMonth, riyadhDay, type CalendarData } from '@/lib/navigation/workspace';
import { useWorkspaceData } from '@/components/navigation/useWorkspaceData';
import WorkspaceState from '@/components/navigation/WorkspaceState';

export default function CalendarPage() {
  const { role } = useAuth();
  const allowedSources = availableCalendarSources(role);
  const today = riyadhDay();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [source, setSource] = useState('all');
  const [selectedDay, setSelectedDay] = useState('');
  const { data, loading, error, refresh } = useWorkspaceData<CalendarData>(`/api/workspace/calendar?month=${month}`);
  function changeMonth(value: string) {
    setMonth(value);
    setSelectedDay('');
  }
  const { start, end } = monthRange(month);
  const offset = new Date(`${start}T12:00:00Z`).getUTCDay();
  const days = Number(end.slice(-2));
  const effectiveSource = allowedSources.includes(source as keyof typeof calendarSources) ? source : 'all';
  const events = (data?.events || []).filter(event => effectiveSource === 'all' || event.source === effectiveSource);
  const visible = events.filter(event => !selectedDay || event.date === selectedDay);
  const title = new Intl.DateTimeFormat('ar-SA', { calendar: 'gregory', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(`${start}T12:00:00Z`));
  return <div className="workspace-page" dir="rtl">
    <div className="workspace-heading"><div><h1>التقويم والمواعيد</h1><p>المتابعات والتجديدات والمستحقات حسب الصلاحيات المتاحة لحسابك. التواريخ بتوقيت الرياض.</p></div><button type="button" onClick={refresh} disabled={loading}><RefreshCw size={16} /> تحديث</button></div>
    <div className="workspace-toolbar">
      <button type="button" aria-label="الشهر السابق" disabled={month === '2000-01'} onClick={() => changeMonth(shiftMonth(month, -1))}><ChevronRight size={18} /></button>
      <h2>{title}</h2>
      <button type="button" aria-label="الشهر التالي" disabled={month === '2100-12'} onClick={() => changeMonth(shiftMonth(month, 1))}><ChevronLeft size={18} /></button>
      <label>الشهر<input type="month" min="2000-01" max="2100-12" value={month} onChange={event => { const value = event.target.value; if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && value >= '2000-01' && value <= '2100-12') changeMonth(value); }} /></label>
      <button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelectedDay(today); }}>اليوم</button>
      <label>المصدر<select aria-label="المصدر" value={effectiveSource} onChange={event => setSource(event.target.value)}><option value="all">كل المصادر</option>{allowedSources.map(key => <option key={key} value={key}>{calendarSources[key]}</option>)}</select></label>
    </div>
    <WorkspaceState loading={loading} error={error} warnings={data?.warnings} refresh={refresh} />
    <section className="workspace-card calendar-board" aria-label={title}>
      <div className="calendar-grid calendar-weekdays">{['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{Array.from({ length: offset }, (_, index) => <div key={`blank:${index}`} aria-hidden="true" className="calendar-blank" />)}{Array.from({ length: days }, (_, index) => {
        const day = `${month}-${String(index + 1).padStart(2, '0')}`;
        const dayEvents = events.filter(event => event.date === day);
        return <button key={day} type="button" className="calendar-day" data-today={day === today || undefined} aria-pressed={selectedDay === day} aria-label={`${day}: ${dayEvents.length} موعد`} onClick={() => setSelectedDay(day === selectedDay ? '' : day)}><strong>{index + 1}</strong>{!!dayEvents.length && <><span className="calendar-preview">{dayEvents[0].title}</span><small>{dayEvents.length} موعد</small></>}</button>;
      })}</div>
    </section>
    <section className="workspace-card"><div className="workspace-heading"><h2>{selectedDay ? `مواعيد ${selectedDay}` : 'مواعيد الشهر'} <span className="workspace-count">{visible.length}</span></h2>{selectedDay && <button type="button" onClick={() => setSelectedDay('')}>عرض الشهر كاملاً</button>}</div>
      {!loading && !error && data && !visible.length && <p className="workspace-empty">لا توجد مواعيد ضمن الاختيار الحالي{data.warnings.length ? ' في المصادر التي تم تحميلها' : ''}.</p>}
      <ul className="workspace-event-list">{visible.map(event => <li key={event.id}><time dateTime={event.scheduledAt || event.date}>{event.date}{event.scheduledAt && <small className="block">{new Date(event.scheduledAt).toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })}</small>}</time><div><strong>{event.title}</strong><p>{calendarSources[event.source]}{calendarStatusLabel(event.status) && <span className="calendar-status">{calendarStatusLabel(event.status)}</span>}</p></div><Link href={event.href}>فتح القسم ←</Link></li>)}</ul>
    </section>
  </div>;
}
