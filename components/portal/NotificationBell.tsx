'use client';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useAttention } from '@/context/AttentionContext';
export default function NotificationBell() {
    const attention = useAttention();
    if (!attention) return null;
    const count = attention.data?.items.length;
    return <Link href="/dashboard#attention" aria-label={attention.error ? 'تعذر تحديث التنبيهات' : count === undefined ? 'التنبيهات قيد التحميل' : `التنبيهات: ${count}`} title="التنبيهات والمهام" className="relative p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white">
        <Bell className="w-4 h-4"/>{attention.error ? <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-900 rounded-full px-1 text-[10px]">!</span> : count !== undefined && count > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full px-1 text-[10px]">{count > 99 ? '99+' : count}</span>}
    </Link>;
}
