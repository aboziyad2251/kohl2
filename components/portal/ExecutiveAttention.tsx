'use client';
import { useAttention } from '@/context/AttentionContext';
import AttentionPanel from './AttentionPanel';
export default function ExecutiveAttention() {
    const attention = useAttention();
    if (!attention) return null;
    const { data, loading, error, refresh, updatedAt } = attention;
    return <section dir="rtl" className="portal-surface rounded-2xl p-4 sm:p-6 space-y-4" aria-label="لوحة المتابعة القيادية">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">ما الذي يحتاج انتباهك اليوم؟</h2><p className="text-sm">المستحقات والتجديدات والاعتمادات من السجلات المرتبطة.</p></div><button className="portal-button" disabled={loading} onClick={() => void refresh()}>{loading ? 'جارٍ التحديث…' : 'تحديث'}</button></div>
        {error && <p role="alert">{error}</p>}
        {loading && !data && !error && <p role="status">جارٍ تحميل التنبيهات…</p>}
        {data && <><div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{[
            ['الإيجار المتأخر', `${data.metrics.overdueRent.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س`, `${data.metrics.overdueCount} مستحق`],
            ['عقود تنتهي خلال 30 يوماً', data.metrics.expiringContracts, 'ابدأ متابعة التجديد'],
            ['اعتمادات صيانة معلقة', data.metrics.approvals, 'بانتظار قرار الإدارة'],
            ['طلبات صيانة مفتوحة', data.metrics.openMaintenance, 'باستثناء المغلقة والملغاة'],
            ['عمولات لم تصرف', `${data.metrics.unpaidCommission.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س`, 'للعقود المؤكد إغلاقها'],
            ['إجمالي التنبيهات', data.items.length, 'مرتبة حسب الأولوية'],
        ].map(([label, value, hint]) => <div key={label} className="portal-card"><h3 className="text-sm">{label}</h3><p className="text-xl sm:text-2xl font-bold my-2 break-words">{value}</p><p className="text-xs text-[#5d7d64]">{hint}</p></div>)}</div><AttentionPanel data={data}/></>}
        {updatedAt && !error && <p className="text-xs text-[#5d7d64]">آخر تحديث: {updatedAt.toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh' })} · تتحدث التنبيهات كل دقيقة أثناء الاستخدام.</p>}
    </section>;
}
