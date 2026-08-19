'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileSignature,
  Building2,
  FileCheck,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  Plus,
  ArrowRightLeft,
  UserCheck,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ClipboardList,
} from 'lucide-react';
import { useData } from '@/context/DataContext';

export default function DashboardPage() {
  const { contracts, properties, ePoas, brokerageAgreements, auditLogs } = useData();

  // Compute KPI metrics
  const activeContractsCount = contracts.filter((c) => c.status === 'Active').length;
  const totalPropertiesCount = properties.length;
  const activeEPoasCount = ePoas.filter((e) => e.status === 'Active').length;
  const expiringBrokerageCount = brokerageAgreements.filter((b) => b.ejar_status === 'Active').length;

  const totalRevenue = contracts.reduce((acc, curr) => acc + curr.rent_amount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner / Welcome */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/60 to-slate-900 border border-sky-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>نظام إداري ديناميكي متصل بقاعدة البيانات وحافظة التخزين الحية</span>
          </div>
          <h1 className="text-2xl font-bold text-white">مرحباً بك في لوحة تحكم المكتب العقاري</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            إدارة شاملة للملكية، العقارات، عقود إيجار السكنية والتجارية، والوكالات الإلكترونية بمرونة وتوثيق دقيق.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/financials/earnings"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <TrendingUp className="w-4 h-4" />
            <span>الأرباح والتقرير اليومي</span>
          </Link>
          <Link
            href="/contracts"
            className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>عقد إيجار جديد</span>
          </Link>
          <Link
            href="/ownership-properties"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 text-sky-400" />
            <span>إدارة العقارات</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">إجمالي العقود النشطة</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <FileSignature className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">{activeContractsCount}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>معدل توثيق 100% منصة إيجار</span>
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">إجمالي العقارات المسجلة</span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">{totalPropertiesCount}</div>
            <div className="text-[11px] text-sky-400 mt-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>مباني وأبراج تجارية وسكنية</span>
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">الوكالات الإلكترونية (E-POAs)</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">{activeEPoasCount}</div>
            <div className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              <span>جميع الوكالات سارية الصلاحية</span>
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl glass-panel glass-panel-hover flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">اتفاقيات الوساطة المعتمدة</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">{expiringBrokerageCount}</div>
            <div className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>محدثة ومربوطة بشبكة إيجار</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Quick Workflows & Recent Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Financial Overview & Property Portfolio */}
        <div className="lg:col-span-2 space-y-6">
          {/* Portfolio Summary Box */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <span>ملخص القيمة الإيجارية وحركة المحفظة</span>
              </h3>
              <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                إجمالي تحصيل: {totalRevenue.toLocaleString('ar-SA')} ر.س
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {properties.map((property) => {
                const propertyContracts = contracts.filter((c) => c.property_id === property.id);
                const propertyRevenue = propertyContracts.reduce((acc, curr) => acc + curr.rent_amount, 0);

                return (
                  <div
                    key={property.id}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">{property.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                        {property.property_type}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>المدينة:</span>
                        <span className="text-slate-200">{property.city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المالك الحالي:</span>
                        <span className="text-slate-200 font-medium">{property.lessor?.name || 'غير محدد'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>الوكيل / الممثل:</span>
                        <span className="text-amber-300">{property.current_representative?.name || 'غير محدد'}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">العقود المرتبطة: {propertyContracts.length}</span>
                      <span className="text-emerald-400 font-bold">{propertyRevenue.toLocaleString('ar-SA')} ر.س</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Workflows Panel */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <h3 className="font-bold text-white text-sm">الإجراءات السريعة والعمليات</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Link
                href="/customer-orders"
                className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/40 text-right transition group"
              >
                <ClipboardList className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition" />
                <div className="font-bold text-xs text-white">طلبات العملاء (سكني/تجاري)</div>
                <div className="text-[10px] text-slate-400 mt-1">تسجيل متابعة الطلبات الواردة</div>
              </Link>

              <Link
                href="/ownership-properties"
                className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/40 text-right transition group"
              >
                <Plus className="w-5 h-5 text-sky-400 mb-2 group-hover:scale-110 transition" />
                <div className="font-bold text-xs text-white">إضافة صك ملكية وعقار</div>
                <div className="text-[10px] text-slate-400 mt-1">تسجيل صك رسمي وإسناد المبنى</div>
              </Link>

              <Link
                href="/ownership-properties"
                className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/40 text-right transition group"
              >
                <UserCheck className="w-5 h-5 text-amber-400 mb-2 group-hover:scale-110 transition" />
                <div className="font-bold text-xs text-white">تغيير وكيل العقار</div>
                <div className="text-[10px] text-slate-400 mt-1">تعديل ممثل المالك وتوثيقه</div>
              </Link>

              <Link
                href="/ownership-properties"
                className="p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/40 text-right transition group"
              >
                <ArrowRightLeft className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition" />
                <div className="font-bold text-xs text-white">نقل ملكية عقار</div>
                <div className="text-[10px] text-slate-400 mt-1">إحالة الملكية لمؤجر جديد</div>
              </Link>
            </div>
          </div>
        </div>

        {/* Right 1 Column: Live Audit Trail */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>سجل التدقيق والعمليات (Audit Logs)</span>
              </h3>
            </div>

            <div className="space-y-4">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-400">
                      {log.change_type === 'LESSOR_TRANSFER' ? 'نقل ملكية عقار' : 'تغيير وكيل العقار'}
                    </span>
                    <span className="text-[10px] text-slate-400 dir-ltr">
                      {new Date(log.changed_at).toLocaleDateString('ar-SA')}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">{log.notes}</p>
                </div>
              ))}
            </div>

            <Link
              href="/ownership-properties"
              className="block text-center py-2 text-xs font-semibold text-sky-400 hover:text-sky-300 transition"
            >
              عرض كامل سجل التدقيق ←
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
