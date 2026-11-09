'use client';
import Link from 'next/link';
import KrAgenda from '@/components/kr/KrAgenda';
import { useSearchParams } from 'next/navigation';
import ExecutiveAttention from '@/components/portal/ExecutiveAttention';
import { navShortcuts } from '@/lib/navigation';
export default function TodayPage() {
  const filter = useSearchParams().get('filter') || 'all';
  return <div className="workspace-page" dir="rtl"><div className="workspace-heading"><div><h1>أعمال اليوم</h1><p>ابدأ بالمستحقات والاعتمادات والتجديدات التي تحتاج متابعة.</p></div><Link href="/calendar">عرض التقويم ←</Link></div>
    <KrAgenda />
    <ExecutiveAttention key={filter} initialFilter={filter} />
    <section className="workspace-card"><h2>انتقال سريع</h2><div className="workspace-shortcuts">{navShortcuts.filter(item => ['collections', 'approvals', 'commissions', 'followups'].includes(item.id)).map(item => <Link href={item.href} key={item.id}>{item.label} ←</Link>)}</div></section>
  </div>;
}
