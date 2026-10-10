'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { AttentionSummary, AttentionTab } from '@/lib/portal/attention';
export default function AttentionPanel({ data, en = false, onSelect }: { data: AttentionSummary; en?: boolean; onSelect?: (tab: AttentionTab) => void }) {
    const [filter, setFilter] = useState('all'), [expanded, setExpanded] = useState(false);
    const t = (ar: string, english: string) => en ? english : ar;
    const filters = ['all', 'payments', 'maintenance', 'broker', 'overview'] as const;
    const labels = { all: t('الكل', 'All'), payments: t('الدفعات', 'Payments'), maintenance: t('الصيانة', 'Maintenance'), broker: t('العمولات', 'Commissions'), overview: t('التجديد', 'Renewals') };
    const items = data.items.filter(item => filter === 'all' || item.tab === filter);
    return <section id="attention" aria-labelledby="attention-heading" className="portal-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="attention-heading" className="text-lg font-bold">{t('تنبيهات ومهام تحتاج متابعة', 'Alerts & actions')}</h2><span className="text-sm">{data.items.length} {t('تنبيه', 'alerts')} · {data.today}</span></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('تصفية التنبيهات', 'Filter alerts')}>{filters.filter(id => id === 'all' || data.items.some(item => item.tab === id)).map(id => <button type="button" key={id} aria-pressed={filter === id} onClick={() => { setFilter(id); setExpanded(false); }} className={`rounded-lg border px-3 py-1 text-sm ${filter === id ? 'bg-[#2F6D3A] text-white' : 'bg-white'}`}>{labels[id]}</button>)}</div>
        {!items.length && <p className="text-[#5d7d64]">{t('لا توجد تنبيهات ضمن هذه الفئة حالياً.', 'No current alerts in this category.')}</p>}
        <ul className="space-y-2">{items.slice(0, expanded ? items.length : 8).map(item => <li key={item.id} className={`border rounded-xl p-3 ${item.kind === 'overdue' ? 'border-red-200 bg-red-50' : 'border-[#BFD9C6]'}`}>
            <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{item.title[en ? 'en' : 'ar']}</p><p className="text-sm break-words">{item.detail[en ? 'en' : 'ar']}</p><p className="text-xs text-[#5d7d64] mt-1">{item.date}{item.amount !== undefined && ` · ${Number(item.amount).toLocaleString(en ? 'en-SA' : 'ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t('ر.س', 'SAR')}`}</p></div>
                {onSelect ? <button className="underline text-sm shrink-0" onClick={() => onSelect(item.tab)}>{t('فتح القسم', 'Open section')}</button> : <Link className="underline text-sm shrink-0" href={`/portal-management?tab=${item.tab}`}>{t('فتح القسم', 'Open section')}</Link>}
            </div>
        </li>)}</ul>
        {items.length > 8 && <button className="underline text-sm" onClick={() => setExpanded(!expanded)}>{expanded ? t('عرض أقل', 'Show fewer') : t('عرض جميع التنبيهات', 'Show all alerts')}</button>}
    </section>;
}
