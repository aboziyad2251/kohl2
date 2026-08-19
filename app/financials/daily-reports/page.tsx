'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Printer,
  Calendar,
  RefreshCw,
  Zap,
  Building,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { AiDailyReport } from '@/lib/types';

export default function DailyReportsPage() {
  const { aiReports, transactions, dailySummaries, properties, ePoas } = useData();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [reports, setReports] = useState<AiDailyReport[]>(aiReports);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync reports if context updates
  React.useEffect(() => {
    if (aiReports && aiReports.length > 0) {
      setReports(aiReports);
    }
  }, [aiReports]);

  // Exact Earnings Calculation for Selected Date (Matches Earnings Page 100%)
  const selectedDateTransactions = transactions.filter((t) => t.transaction_date === selectedDate);

  const earningsGross = selectedDateTransactions
    .filter((t) => t.flow_type === 'INCOME')
    .reduce((sum, t) => sum + t.gross_amount, 0);

  const earningsExpenses = selectedDateTransactions
    .filter((t) => t.flow_type === 'EXPENSE')
    .reduce((sum, t) => sum + t.net_amount, 0);

  const earningsNet = earningsGross - earningsExpenses;

  // Check if daily summary exists for selected date
  const summaryForDate = dailySummaries.find((s) => s.summary_date === selectedDate);
  const effectiveGross = selectedDateTransactions.length > 0
    ? earningsGross
    : summaryForDate
    ? summaryForDate.total_gross_income
    : 50000;

  const effectiveNet = selectedDateTransactions.length > 0
    ? earningsNet
    : summaryForDate
    ? summaryForDate.total_net_income
    : 44825;

  // Find active report for selected date, or fallback
  const rawActiveReport =
    reports.find((r) => r.report_date === selectedDate) ||
    reports[0] || {
      id: 'adr-demo',
      report_date: selectedDate,
      gross_income: effectiveGross,
      net_income: effectiveNet,
      what_went_well: [
        'إغلاق اتفاقيتي وساطة تجارية وتحصيل العمولات المباشرة.',
        'تحصيل الدفعة الإيجارية السكنية بانتظام عبر المكتب.',
        'توثيق العقود والوساطات المنفذة اليوم عبر منصة إيجار بانتظام.'
      ],
      what_went_bad: [
        'وجود وحدات سكنية شاغرة متوقفة لأكثر من 10 أيام دون تأجير.',
        'تأخر توثيق وكالة إلكترونية واحدة للمالك مما يعطل إبرام عقد جديد.',
        'ارتفاع تكاليف الصيانة التشغيلية في بعض المباني.'
      ],
      ai_recommendations: [
        'إطلاق تقديم خصم تشجيعي بنسبة 5% لسرعة شغل الوحدات السكنية الشاغرة خلال 48 ساعة.',
        'متابعة كتابة العدل لإصدار الوكالة الإلكترونية المعلقة لإغلاق العقد العقاري الجديد غداً.',
        'إعادة تفاوض عقود الصيانة السنوية للحصول على خصم كميات وتقليل المصاريف التشغيلية.'
      ],
      income_increment_strategy:
        'التركيز الفوري غداً على استكمال توثيق العقود المعلقة وإبرام الاتفاقيات الجديدة لزيادة الإيرادات الإجمالية والصافية للمكتب.',
    };

  // Enforce 100% Match with Earnings Page Metrics
  const activeReport = {
    ...rawActiveReport,
    report_date: selectedDate,
    gross_income: effectiveGross,
    net_income: effectiveNet,
  };

  const handleGenerateAiReport = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/financials/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_date: selectedDate,
          grossIncome: effectiveGross,
          netIncome: effectiveNet,
          transactions: selectedDateTransactions,
          operationalStatus: { vacantUnitsCount: 3, pendingEPoasCount: ePoas.length },
        }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        const newReport: AiDailyReport = {
          ...data.report,
          gross_income: effectiveGross,
          net_income: effectiveNet,
        };
        const updated = [
          newReport,
          ...reports.filter((r) => r.report_date !== newReport.report_date),
        ];
        setReports(updated);
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200 print:bg-white print:text-black">
      {/* Top Banner & Actions (Hidden during print) */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/60 to-slate-900 border border-sky-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl print:hidden">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>محرك مستشار الذكاء الاصطناعي لزيادة الدخل (AI Engine)</span>
          </div>
          <h1 className="text-2xl font-bold text-white">التقرير اليومي ومستشار الذكاء الاصطناعي</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            تحليل الأداء اليومي ("أين نجحنا" مقابل "ما هي الاختناقات والتسريبات") وتوصيات فورية لزيادة أرباح الغد.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none text-xs"
            />
          </div>

          <button
            onClick={handleGenerateAiReport}
            disabled={isGenerating}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'جاري تحليل البيانات...' : 'توليد تحليل AI اليوم'}</span>
          </button>

          <button
            onClick={handlePrintPdf}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-sky-400" />
            <span>تصدير PDF / طباعة</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Container */}
      <div className="space-y-6 print:space-y-4">
        {/* Daily Snapshot Header */}
        <div className="p-6 rounded-2xl glass-panel space-y-4 print:border print:border-slate-300 print:bg-white print:text-black">
          <div className="flex items-center justify-between border-b border-slate-800 print:border-slate-300 pb-4">
            <div>
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs print:text-black">
                <Building className="w-4 h-4" />
                <span>مكتب العقارات المعتمد - تقرير الأداء اليومي</span>
              </div>
              <h2 className="text-xl font-extrabold text-white print:text-black mt-1">
                ملخص اليوم المالي التشغيلي: <span className="dir-ltr">{activeReport.report_date}</span>
              </h2>
            </div>

            <div className="text-left">
              <span className="text-[11px] text-slate-400 print:text-slate-600 block">مرجع التقرير:</span>
              <span className="font-mono text-xs text-sky-400 print:text-black font-bold">
                REF-{activeReport.report_date.replace(/-/g, '')}-AI
              </span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:border-slate-300 print:bg-slate-50">
              <span className="text-[11px] text-slate-400 print:text-slate-600 block">إجمالي الدخل اليومي (Gross)</span>
              <span className="text-xl font-extrabold text-sky-400 print:text-black">
                {activeReport.gross_income.toLocaleString('ar-SA')} ر.س
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:border-slate-300 print:bg-slate-50">
              <span className="text-[11px] text-slate-400 print:text-slate-600 block">صافي الأرباح (Net Income)</span>
              <span className="text-xl font-extrabold text-emerald-400 print:text-emerald-700">
                {activeReport.net_income.toLocaleString('ar-SA')} ر.س
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:border-slate-300 print:bg-slate-50">
              <span className="text-[11px] text-slate-400 print:text-slate-600 block">الصفقات الإيجارية المغلقة</span>
              <span className="text-xl font-extrabold text-purple-400 print:text-purple-700">2 صفقات جديدة</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:border-slate-300 print:bg-slate-50">
              <span className="text-[11px] text-slate-400 print:text-slate-600 block">نسبة الإشغال الإجمالية</span>
              <span className="text-xl font-extrabold text-amber-400 print:text-amber-700">87.5%</span>
            </div>
          </div>
        </div>

        {/* Strategic AI Highlight Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-sky-950/40 border border-amber-500/30 space-y-3 print:bg-amber-50 print:border-amber-300 print:text-black">
          <div className="flex items-center gap-2 text-amber-400 print:text-amber-800 font-bold text-xs">
            <Zap className="w-4 h-4" />
            <span>استراتيجية التعظيم السريع للدخل (Income Increment Strategy)</span>
          </div>
          <p className="text-sm font-semibold text-slate-200 print:text-black leading-relaxed">
            "{activeReport.income_increment_strategy}"
          </p>
        </div>

        {/* Main 2-Column Section: Positive Drivers vs Bottlenecks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 🟢 "Where Was Good" (Positive Drivers) */}
          <div className="p-6 rounded-2xl glass-panel space-y-4 print:border print:border-slate-300 print:bg-white">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800 print:border-slate-300">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white print:text-black text-sm">🟢 أين نجحنا اليوم (Where Was Good)</h3>
                <p className="text-[11px] text-slate-400 print:text-slate-600">محركات النمو والإنجازات التشغيلية والمالية المحققة</p>
              </div>
            </div>

            <ul className="space-y-3">
              {activeReport.what_went_well.map((item, idx) => (
                <li
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 print:bg-slate-50 print:border-slate-200 text-xs text-slate-200 print:text-black flex items-start gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 🔴 "What Went Bad" (Bottlenecks & Revenue Leaks) */}
          <div className="p-6 rounded-2xl glass-panel space-y-4 print:border print:border-slate-300 print:bg-white">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800 print:border-slate-300">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white print:text-black text-sm">🔴 التحديات والتسريبات المالية (What Went Bad)</h3>
                <p className="text-[11px] text-slate-400 print:text-slate-600">عوامل تباطؤ الدخل والفرص المفقودة والتأخيرات</p>
              </div>
            </div>

            <ul className="space-y-3">
              {activeReport.what_went_bad.map((item, idx) => (
                <li
                  key={idx}
                  className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 print:bg-slate-50 print:border-slate-200 text-xs text-slate-200 print:text-black flex items-start gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 💡 AI Increment Recommendations */}
        <div className="p-6 rounded-2xl glass-panel space-y-4 print:border print:border-slate-300 print:bg-white">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800 print:border-slate-300">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white print:text-black text-sm">💡 توصيات AI التنفيذية لزيادة دخل الغد</h3>
              <p className="text-[11px] text-slate-400 print:text-slate-600">خطوات عمل مباشرة مستخرجة ذكائياً لتعظيم الإيرادات الإجمالية والصافية</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeReport.ai_recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 print:bg-slate-50 print:border-slate-300 space-y-2"
              >
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs print:text-sky-800">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>توصية #{idx + 1}</span>
                </div>
                <p className="text-xs text-slate-200 print:text-black leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Signature Box for Management Review */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 print:bg-slate-100 print:border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-sky-400 print:text-black" />
            <div>
              <div className="font-bold text-white print:text-black">اعتماد إدارة المكتب العقاري</div>
              <div className="text-[10px] text-slate-400 print:text-slate-600">تم إنشاء التحليل تلقائياً بواسطة محرك الذكاء الاصطناعي الداعم للمكتب</div>
            </div>
          </div>

          <div className="text-left text-slate-400 print:text-black">
            <span>تاريخ التصدير والطباعة: </span>
            <span className="font-semibold text-white print:text-black dir-ltr">{new Date().toLocaleString('ar-SA')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
