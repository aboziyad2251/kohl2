'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Filter,
  Search,
  Calendar,
  Building2,
  PieChart,
  BarChart3,
  CheckCircle2,
  FileSignature,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { FinancialTransaction, FlowType, TransactionType } from '@/lib/types';
import { getTransactionTypeMeta } from '@/lib/services/financials';
import NewTransactionModal from '@/components/financials/NewTransactionModal';
import EditTransactionModal from '@/components/financials/EditTransactionModal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';

export default function FinancialEarningsPage() {
  const {
    transactions,
    dailySummaries,
    properties,
    contracts,
    brokerageAgreements,
    generalServices,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useData();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<FinancialTransaction | null>(null);
  const [flowFilter, setFlowFilter] = useState<'ALL' | FlowType>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Office Profit from Contracts, Brokerage Agreements, and General Services
  const contractsOfficeProfit = contracts.reduce((sum, c) => sum + (c.office_profit || 0), 0);
  const brokerageOfficeProfit = brokerageAgreements.reduce((sum, b) => sum + (b.office_profit || 0), 0);
  const generalServicesOfficeProfit = (generalServices || []).reduce((sum: number, g: any) => sum + (g.office_profit || 0), 0);
  const totalLessorCollected = contracts.reduce((sum, c) => sum + (c.total_collected_amount || c.rent_amount), 0);

  // Daily Calculations for Today
  const todayTransactions = transactions.filter((t) => t.transaction_date === todayStr);

  const dailyDirectIncome = todayTransactions
    .filter((t) => t.flow_type === 'INCOME')
    .reduce((acc, curr) => acc + curr.gross_amount, 0);

  const dailyExpenses = todayTransactions
    .filter((t) => t.flow_type === 'EXPENSE')
    .reduce((acc, curr) => acc + curr.net_amount, 0);

  // Core Office Daily Profit Rule: Contracts + Brokerage + General Services + Direct Transactions - Expenses
  const dailyOfficeProfit = contractsOfficeProfit + brokerageOfficeProfit + generalServicesOfficeProfit + dailyDirectIncome - dailyExpenses;
  const dailyGrossEarnings = contractsOfficeProfit + brokerageOfficeProfit + generalServicesOfficeProfit + dailyDirectIncome;
  const dailyNetEarnings = dailyOfficeProfit;

  // MTD (Month-to-Date) Calculations
  const mtdTransactions = transactions.filter((t) => {
    const txMonth = t.transaction_date.slice(0, 7);
    const currentMonth = todayStr.slice(0, 7);
    return txMonth === currentMonth;
  });

  const mtdGross = mtdTransactions
    .filter((t) => t.flow_type === 'INCOME')
    .reduce((acc, curr) => acc + curr.gross_amount, 0);

  const mtdNet = mtdTransactions.reduce((acc, curr) => {
    return curr.flow_type === 'INCOME' ? acc + curr.net_amount : acc - curr.net_amount;
  }, 0);

  // YTD (Year-to-Date) Calculations
  const ytdTransactions = transactions.filter((t) => {
    const txYear = t.transaction_date.slice(0, 4);
    const currentYear = todayStr.slice(0, 4);
    return txYear === currentYear;
  });

  const ytdGross = ytdTransactions
    .filter((t) => t.flow_type === 'INCOME')
    .reduce((acc, curr) => acc + curr.gross_amount, 0);

  // Income Breakdown by Category
  const incomeByType = {
    BROKERAGE_COMMISSION: transactions
      .filter((t) => t.transaction_type === 'BROKERAGE_COMMISSION' && t.flow_type === 'INCOME')
      .reduce((sum, t) => sum + t.gross_amount, 0),
    RENTAL_PAYMENT: transactions
      .filter((t) => t.transaction_type === 'RENTAL_PAYMENT' && t.flow_type === 'INCOME')
      .reduce((sum, t) => sum + t.gross_amount, 0),
    DOCUMENT_FEE: transactions
      .filter((t) => t.transaction_type === 'DOCUMENT_FEE' && t.flow_type === 'INCOME')
      .reduce((sum, t) => sum + t.gross_amount, 0),
    MANAGEMENT_FEE: transactions
      .filter((t) => t.transaction_type === 'MANAGEMENT_FEE' && t.flow_type === 'INCOME')
      .reduce((sum, t) => sum + t.gross_amount, 0),
  };

  const totalAllIncome = Object.values(incomeByType).reduce((a, b) => a + b, 0) || 1;

  // Filtered Transactions for Table
  const filteredTransactions = transactions.filter((t) => {
    if (flowFilter !== 'ALL' && t.flow_type !== flowFilter) return false;
    if (typeFilter !== 'ALL' && t.transaction_type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const notesMatch = t.notes?.toLowerCase().includes(q);
      const typeMatch = t.transaction_type.toLowerCase().includes(q);
      const propTitle = t.property?.title?.toLowerCase().includes(q);
      return notesMatch || typeMatch || propTitle;
    }
    return true;
  });

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/60 to-slate-900 border border-sky-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
            <Wallet className="w-4 h-4" />
            <span>نظام التدفقات المالية والإيرادات اليومية</span>
          </div>
          <h1 className="text-2xl font-bold text-white">مركز الأرباح والمعاملات المالية</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            متابعة الإيرادات الإجمالية، المصروفات التشغيلية، وصافي أرباح المكتب اليومية والشهرية بدقة عالية.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل معاملة مالية</span>
          </button>
          <Link
            href="/financials/daily-reports"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <span>التقرير اليومي ومستشار AI</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Net Office Daily Profit */}
        <div className="p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between space-y-4 border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">صافي أرباح المكتب اليومية *</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-amber-300">
              {dailyOfficeProfit.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span>
            </div>
            <div className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>مباشرة من أرباح العقود والوساطة</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Contracts & Brokerage Profit Breakout */}
        <div className="p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">أرباح العقود والوساطة (مكتب)</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span>أرباح عقود الإيجار:</span>
              <span className="font-bold text-emerald-400">{contractsOfficeProfit.toLocaleString('ar-SA')} ر.س</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>أرباح اتفاقيات الوساطة:</span>
              <span className="font-bold text-teal-400">{brokerageOfficeProfit.toLocaleString('ar-SA')} ر.س</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Lessor Collections (Recorded Only, Excluded from Office Profit) */}
        <div className="p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between space-y-4 bg-slate-950/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">تحصيلات المؤجرين (تُحفظ للمالك فقط)</span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-300">
              {totalLessorCollected.toLocaleString('ar-SA')} <span className="text-xs text-slate-500 font-normal">ر.س</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              ⚠️ تُسجل توثيقياً فقط ولا تُحتسب في أرباح المكتب اليومية.
            </div>
          </div>
        </div>

        {/* KPI 4: Operating Expenses */}
        <div className="p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">المصروفات والاستقطاعات</span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-rose-400">
              {dailyExpenses.toLocaleString('ar-SA')} <span className="text-xs font-normal">ر.س</span>
            </div>
            <div className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
              <span>مصاريف التشغيل وصيانة المباني</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Financial Trend Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span>مخطط حركة الأرباح الإجمالية والصافية اليومية</span>
            </h3>
            <span className="text-xs text-slate-400">أخر الأيام المسجلة</span>
          </div>

          <div className="space-y-4">
            {dailySummaries.map((sum) => {
              const maxGross = 60000;
              const grossWidth = Math.min(100, (sum.total_gross_income / maxGross) * 100);
              const netWidth = Math.min(100, (sum.total_net_income / maxGross) * 100);

              return (
                <div key={sum.id} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white dir-ltr">{sum.summary_date}</span>
                    <div className="flex gap-3 text-[11px]">
                      <span className="text-sky-400 font-semibold">
                        إجمالي: {sum.total_gross_income.toLocaleString('ar-SA')} ر.س
                      </span>
                      <span className="text-emerald-400 font-bold">
                        صافي: {sum.total_net_income.toLocaleString('ar-SA')} ر.س
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-sky-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${grossWidth}%` }}
                      />
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${netWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Income Sources Distribution */}
        <div className="p-6 rounded-2xl glass-panel space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-400" />
              <span>توزيع الإيرادات حسب المصدر</span>
            </h3>
          </div>

          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">عمولات الوساطة العقارية</span>
                <span className="text-emerald-400 font-bold">
                  {incomeByType.BROKERAGE_COMMISSION.toLocaleString('ar-SA')} ر.س
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{
                    width: `${((incomeByType.BROKERAGE_COMMISSION / totalAllIncome) * 100).toFixed(0)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">تحصيل مبالغ الإيجار الدورية</span>
                <span className="text-sky-400 font-bold">
                  {incomeByType.RENTAL_PAYMENT.toLocaleString('ar-SA')} ر.س
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-sky-500 h-full rounded-full"
                  style={{
                    width: `${((incomeByType.RENTAL_PAYMENT / totalAllIncome) * 100).toFixed(0)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">رسوم خدمات وتوثيق العقود</span>
                <span className="text-purple-400 font-bold">
                  {incomeByType.DOCUMENT_FEE.toLocaleString('ar-SA')} ر.س
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-purple-500 h-full rounded-full"
                  style={{
                    width: `${((incomeByType.DOCUMENT_FEE / totalAllIncome) * 100).toFixed(0)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">رسوم أمانة وإدارة الأملاك</span>
                <span className="text-amber-400 font-bold">
                  {incomeByType.MANAGEMENT_FEE.toLocaleString('ar-SA')} ر.س
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{
                    width: `${((incomeByType.MANAGEMENT_FEE / totalAllIncome) * 100).toFixed(0)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Ledger Data Table */}
      <div className="p-6 rounded-2xl glass-panel space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="font-bold text-white text-base">سجل المعاملات المالية المعتمد (Ledger)</h3>
            <p className="text-xs text-slate-400">جدول السجلات المالية مع حساب صافي التدفق التلقائي</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث في الملاحظات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={flowFilter}
              onChange={(e) => setFlowFilter(e.target.value as any)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">جميع التدفقات</option>
              <option value="INCOME">إيرادات فقط (+)</option>
              <option value="EXPENSE">مصروفات فقط (-)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5 font-semibold">تاريخ المعاملة</th>
                <th className="p-3.5 font-semibold">نوع التدفق</th>
                <th className="p-3.5 font-semibold">تصنيف المعاملة</th>
                <th className="p-3.5 font-semibold">مورد الأرباح (العقد / اتفاقية الوساطة)</th>
                <th className="p-3.5 font-semibold">العقار المرتبط</th>
                <th className="p-3.5 font-semibold">المبلغ الإجمالي</th>
                <th className="p-3.5 font-semibold">ضريبة VAT</th>
                <th className="p-3.5 font-semibold">الصافي المحسوب</th>
                <th className="p-3.5 font-semibold">ملاحظات</th>
                <th className="p-3.5 text-center font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">
                    لا توجد معاملات مالية مطابقة للفلتر المحدد
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const meta = getTransactionTypeMeta(tx.transaction_type);
                  const linkedContract = contracts.find((c) => c.id === tx.contract_id) || tx.contract;
                  const linkedBrokerage = brokerageAgreements.find((b) => b.id === tx.brokerage_agreement_id) || tx.brokerage_agreement;

                  return (
                    <tr key={tx.id} className="hover:bg-slate-900/60 transition">
                      <td className="p-3.5 font-mono text-slate-300 dir-ltr">{tx.transaction_date}</td>
                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            tx.flow_type === 'INCOME'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {tx.flow_type === 'INCOME' ? (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              إيراد (+)
                            </>
                          ) : (
                            <>
                              <ArrowDownRight className="w-3 h-3" />
                              مصروف (-)
                            </>
                          )}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${meta.badgeBg} ${meta.badgeText}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-sky-400">
                        {linkedContract ? (
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px]">
                            📜 عقد #{linkedContract.contract_number} ({linkedContract.tenant_name})
                          </span>
                        ) : linkedBrokerage ? (
                          <span className="px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px]">
                            🤝 وساطة #{linkedBrokerage.agreement_number} ({linkedBrokerage.commission_rate}%)
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">عام / غير مرتبط بعقد</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-300">
                        {tx.property?.title || 'عام / غير محدد'}
                      </td>
                      <td className="p-3.5 font-bold text-white">
                        {tx.gross_amount.toLocaleString('ar-SA')} ر.س
                      </td>
                      <td className="p-3.5 text-slate-400">
                        {tx.tax_vat_amount ? `${tx.tax_vat_amount.toLocaleString('ar-SA')} ر.س` : '-'}
                      </td>
                      <td
                        className={`p-3.5 font-extrabold ${
                          tx.flow_type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {tx.flow_type === 'INCOME' ? '+' : '-'}
                        {tx.net_amount.toLocaleString('ar-SA')} ر.س
                      </td>
                      <td className="p-3.5 text-slate-300 max-w-xs truncate">{tx.notes || '-'}</td>
                      <td className="p-3.5 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditTransaction(tx)}
                          className="p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition"
                          title="تعديل المعاملة"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              id: tx.id,
                              name: `معاملة ${meta.label} بمبلغ ${tx.net_amount.toLocaleString('ar-SA')} ر.س`,
                            })
                          }
                          className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                          title="حذف المعاملة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={addTransaction}
        properties={properties}
        contracts={contracts}
        brokerageAgreements={brokerageAgreements}
      />

      <EditTransactionModal
        isOpen={!!editTransaction}
        onClose={() => setEditTransaction(null)}
        transaction={editTransaction}
        properties={properties}
        contracts={contracts}
        brokerageAgreements={brokerageAgreements}
        onSuccess={updateTransaction}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        itemName={deleteTarget?.name}
      />
    </div>
  );
}
