'use client';

import React, { useState } from 'react';
import { useData } from '@/context/DataContext';
import NewGeneralServiceModal from '@/components/general-services/NewGeneralServiceModal';
import EditGeneralServiceModal from '@/components/general-services/EditGeneralServiceModal';
import { GeneralService, ServiceCategory, ServiceStatus } from '@/lib/types';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  DollarSign,
  Pencil,
  Trash2,
  FileText,
  Building,
  User,
  Phone,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function GeneralServicesPage() {
  const { generalServices, addGeneralService, updateGeneralService, deleteGeneralService, isLoading } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<GeneralService | null>(null);

  // Filter logic
  const filteredServices = generalServices.filter((s) => {
    const matchesSearch =
      s.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.service_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.client_phone && s.client_phone.includes(searchQuery));

    const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
    const matchesStatus = selectedStatus === 'ALL' || s.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Calculate Metrics
  const totalCount = generalServices.length;
  const totalProfit = generalServices.reduce((sum, s) => sum + (s.office_profit || 0), 0);
  const inProgressCount = generalServices.filter((s) => s.status === 'In_Progress' || s.status === 'Pending').length;
  const completedCount = generalServices.filter((s) => s.status === 'Completed').length;

  const categoryLabels: Record<ServiceCategory, { label: string; bg: string; text: string }> = {
    EJAR: { label: 'منصة إيجار', bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
    BALADY: { label: 'منصة بلدي', bg: 'bg-sky-500/20', text: 'text-sky-300' },
    QIWA: { label: 'منصة قوى', bg: 'bg-purple-500/20', text: 'text-purple-300' },
    DEED_SURVEY: { label: 'صكوك ورفع مساحي', bg: 'bg-amber-500/20', text: 'text-amber-300' },
    GOV_TRANSACTION: { label: 'معاملات كتابة العدل', bg: 'bg-teal-500/20', text: 'text-teal-300' },
    OTHER: { label: 'خدمات عامة أخرى', bg: 'bg-slate-500/20', text: 'text-slate-300' },
  };

  const statusBadges: Record<ServiceStatus, { label: string; bg: string; text: string }> = {
    Completed: { label: 'مكتملة', bg: 'bg-emerald-500/20', text: 'text-emerald-300 border-emerald-500/30' },
    In_Progress: { label: 'جاري التنفيذ', bg: 'bg-sky-500/20', text: 'text-sky-300 border-sky-500/30' },
    Pending: { label: 'قيد الانتظار', bg: 'bg-amber-500/20', text: 'text-amber-300 border-amber-500/30' },
    Cancelled: { label: 'ملغاة', bg: 'bg-red-500/20', text: 'text-red-300 border-red-500/30' },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
                  🏛️
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">الخدمات العامة والمعاملات الحكومية</h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                سجل متابعة المعاملات (إيجار، بلدي، قوى، صكوك ومخططات) وتتبع أرباح المكتب المباشرة.
              </p>
            </div>

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل معاملة جديدة</span>
            </button>
          </div>

          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-md">
              <div>
                <span className="text-xs text-slate-400 font-medium block">إجمالي المعاملات والخدمات</span>
                <span className="text-2xl font-black text-white mt-1 block">{totalCount} معاملة</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Briefcase className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-md">
              <div>
                <span className="text-xs text-emerald-400 font-bold block">إجمالي أرباح المكتب من الخدمات</span>
                <span className="text-2xl font-black text-emerald-300 mt-1 block">
                  {totalProfit.toLocaleString('ar-SA')} ر.س
                </span>
                <span className="text-[10px] text-emerald-400/80">تضاف فوراً في الأرباح اليومية للمكتب</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-md">
              <div>
                <span className="text-xs text-slate-400 font-medium block">معاملات قيد التنفيذ</span>
                <span className="text-2xl font-black text-sky-400 mt-1 block">{inProgressCount} معاملة</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-md">
              <div>
                <span className="text-xs text-slate-400 font-medium block">المعاملات المكتملة</span>
                <span className="text-2xl font-black text-emerald-400 mt-1 block">{completedCount} معاملة</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3 md:space-y-0 md:flex md:items-center md:justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="البحث باسم العميل، رقم الجوال، أو رقم الخدمة والمعاملة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">التصنيف:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent text-white focus:outline-none text-xs"
                >
                  <option value="ALL" className="bg-slate-900">كل التصنيفات</option>
                  <option value="EJAR" className="bg-slate-900">منصة إيجار</option>
                  <option value="BALADY" className="bg-slate-900">منصة بلدي</option>
                  <option value="QIWA" className="bg-slate-900">منصة قوى</option>
                  <option value="DEED_SURVEY" className="bg-slate-900">صكوك ورفع مساحي</option>
                  <option value="GOV_TRANSACTION" className="bg-slate-900">معاملات كتابة العدل</option>
                  <option value="OTHER" className="bg-slate-900">خدمات أخرى</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                <span className="text-slate-400">الحالة:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent text-white focus:outline-none text-xs"
                >
                  <option value="ALL" className="bg-slate-900">جميع الحالات</option>
                  <option value="Completed" className="bg-slate-900">مكتملة</option>
                  <option value="In_Progress" className="bg-slate-900">جاري التنفيذ</option>
                  <option value="Pending" className="bg-slate-900">قيد الانتظار</option>
                  <option value="Cancelled" className="bg-slate-900">ملغاة</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Services Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/50 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-4">رقم الخدمة</th>
                    <th className="p-4">العميل ورقم التواصل</th>
                    <th className="p-4">تصنيف ونوع الخدمة</th>
                    <th className="p-4">المبلغ المحصل</th>
                    <th className="p-4">التكلفة والرسوم</th>
                    <th className="p-4 text-amber-300">ربح المكتب الفعلي</th>
                    <th className="p-4">حالة المعاملة</th>
                    <th className="p-4 text-center">إجراءات والتعديل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        جاري تحميل سجل الخدمات المعاملات...
                      </td>
                    </tr>
                  ) : filteredServices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        لا توجد خدمات أو معاملات مطابقة لشروط البحث.
                      </td>
                    </tr>
                  ) : (
                    filteredServices.map((service) => {
                      const catBadge = categoryLabels[service.category as ServiceCategory] || categoryLabels.OTHER;
                      const stBadge = statusBadges[service.status as ServiceStatus] || statusBadges.Pending;

                      return (
                        <tr key={service.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-4 font-mono font-bold text-purple-300">
                            {service.service_number}
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-white">{service.client_name}</div>
                            {service.client_phone && (
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5" dir="ltr">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{service.client_phone}</span>
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${catBadge.bg} ${catBadge.text} mb-1`}>
                              {catBadge.label}
                            </span>
                            <div className="font-medium text-slate-200">{service.title}</div>
                          </td>
                          <td className="p-4 font-semibold text-slate-200">
                            {service.fee_amount.toLocaleString('ar-SA')} ر.س
                          </td>
                          <td className="p-4 text-slate-400">
                            {service.cost_amount.toLocaleString('ar-SA')} ر.س
                          </td>
                          <td className="p-4">
                            <span className="font-extrabold text-amber-300 text-sm px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 inline-block">
                              {service.office_profit.toLocaleString('ar-SA')} ر.س
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${stBadge.bg} ${stBadge.text}`}>
                              {stBadge.label}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setEditingService(service)}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition"
                                title="تعديل المعاملة"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`هل أنت تأكدت من حذف معاملة ${service.service_number}؟`)) {
                                    deleteGeneralService(service.id);
                                  }
                                }}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-400 hover:text-red-300 transition"
                                title="حذف المعاملة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
        </div>

      {/* New Service Modal */}
      <NewGeneralServiceModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={(newSrv) => {
          addGeneralService(newSrv);
        }}
      />

      {/* Edit Service Modal */}
      <EditGeneralServiceModal
        isOpen={!!editingService}
        onClose={() => setEditingService(null)}
        service={editingService}
        onSuccess={(updatedSrv) => {
          updateGeneralService(updatedSrv);
        }}
        onDelete={(id) => {
          deleteGeneralService(id);
        }}
      />
    </div>
  );
}
