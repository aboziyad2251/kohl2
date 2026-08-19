'use client';

import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { ManagedPropertyContract, PropertyMaintenanceTask, ManagementStatus, MaintenanceStatus } from '../../lib/types';
import NewManagedPropertyModal from '../../components/property-management/NewManagedPropertyModal';
import EditManagedPropertyModal from '../../components/property-management/EditManagedPropertyModal';
import NewMaintenanceTaskModal from '../../components/property-management/NewMaintenanceTaskModal';
import EditMaintenanceTaskModal from '../../components/property-management/EditMaintenanceTaskModal';
import * as XLSX from 'xlsx';
import {
  Building,
  Wrench,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  XCircle,
  Phone,
  User,
  Home,
  Briefcase,
  Layers,
  Coins,
  MessageCircle,
  TrendingUp,
  AlertTriangle,
  Edit,
  Eye,
  Percent,
} from 'lucide-react';

export default function PropertyManagementPage() {
  const { managedProperties, maintenanceTasks, updateManagedProperty, updateMaintenanceTask } = useData();

  const [activeTab, setActiveTab] = useState<'CONTRACTS' | 'MAINTENANCE' | 'STATEMENTS'>('CONTRACTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal States
  const [isAddPropertyModalOpen, setIsAddPropertyModalOpen] = useState(false);
  const [isAddMaintenanceModalOpen, setIsAddMaintenanceModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ManagedPropertyContract | null>(null);
  const [editingTask, setEditingTask] = useState<PropertyMaintenanceTask | null>(null);
  const [viewingContract, setViewingContract] = useState<ManagedPropertyContract | null>(null);

  // Filtered Managed Properties
  const filteredProperties = managedProperties.filter((prop) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      prop.property_name.toLowerCase().includes(q) ||
      prop.lessor_name.toLowerCase().includes(q) ||
      prop.lessor_phone.includes(q) ||
      prop.contract_number.toLowerCase().includes(q) ||
      (prop.notes && prop.notes.toLowerCase().includes(q));

    const matchesType = typeFilter === 'ALL' || prop.property_type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || prop.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Filtered Maintenance Tasks
  const filteredTasks = maintenanceTasks.filter((task) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      task.property_name.toLowerCase().includes(q) ||
      task.task_number.toLowerCase().includes(q) ||
      task.maintenance_type.toLowerCase().includes(q) ||
      (task.contractor_name && task.contractor_name.toLowerCase().includes(q)) ||
      (task.unit_name && task.unit_name.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Analytics Metrics
  const totalProperties = managedProperties.length;
  const totalUnits = managedProperties.reduce((acc, p) => acc + p.total_units, 0);
  const totalOccupied = managedProperties.reduce((acc, p) => acc + p.occupied_units, 0);
  const totalVacant = managedProperties.reduce((acc, p) => acc + p.vacant_units, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0;

  const totalCollectedRevenue = managedProperties.reduce((acc, p) => acc + p.collected_revenue, 0);
  const totalOfficeFeesEarned = managedProperties.reduce((acc, p) => {
    const fee = p.fee_type === 'PERCENTAGE' ? (p.collected_revenue * p.fee_value) / 100 : p.fee_value;
    return acc + fee;
  }, 0);
  const totalNetOwnerPayout = Math.max(0, totalCollectedRevenue - totalOfficeFeesEarned);

  const activeMaintenanceCost = maintenanceTasks
    .filter((t) => t.status === 'In_Progress' || t.status === 'Completed')
    .reduce((acc, t) => acc + t.cost_amount, 0);

  // Quick Status Handlers
  const handlePropertyStatusChange = async (contract: ManagedPropertyContract, newStatus: ManagementStatus) => {
    await updateManagedProperty({ ...contract, status: newStatus });
  };

  const handleTaskStatusChange = async (task: PropertyMaintenanceTask, newStatus: MaintenanceStatus) => {
    await updateMaintenanceTask({ ...task, status: newStatus });
  };

  // Export to Excel
  const exportManagedPropertiesToExcel = () => {
    const dataToExport = managedProperties.map((p, idx) => ({
      '#': idx + 1,
      'رقم عقد الإدارة': p.contract_number,
      'اسم العقار / المجمع': p.property_name,
      'اسم المالك': p.lessor_name,
      'جوال المالك': p.lessor_phone,
      'نوع العقار': p.property_type === 'Residential' ? 'سكني' : p.property_type === 'Commercial' ? 'تجاري' : 'مختلط',
      'إجمالي الوحدات': p.total_units,
      'المؤجرة': p.occupied_units,
      'الشاغرة': p.vacant_units,
      'طريقة الأتعاب': p.fee_type === 'PERCENTAGE' ? `${p.fee_value}%` : `${p.fee_value} ر.س`,
      'الإيراد المتوقع (ر.س)': p.annual_expected_revenue,
      'التحصيل الفعلي (ر.س)': p.collected_revenue,
      'صافي المالك (ر.س)': p.transferred_to_owner,
      'تاريخ البداية': p.start_date,
      'تاريخ النهاية': p.end_date,
      'حالة العقد': p.status === 'Active' ? 'نشط' : 'منتهي',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    if (!worksheet['!views']) worksheet['!views'] = [];
    worksheet['!views'].push({ RTL: true });

    worksheet['!cols'] = [
      { wch: 5 },  { wch: 16 }, { wch: 25 }, { wch: 22 }, { wch: 15 },
      { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 },
      { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'إدارة الأملاك');
    XLSX.writeFile(workbook, `تقرير_إدارة_الأملاك_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusBadge = (status: ManagementStatus) => {
    switch (status) {
      case 'Active':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            نشط (Active)
          </span>
        );
      case 'Under_Renewal':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            قيد التجديد
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            منتهي
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
            موقوف
          </span>
        );
    }
  };

  const getTaskStatusBadge = (status: MaintenanceStatus) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            مكتملة ومسددة
          </span>
        );
      case 'In_Progress':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            قيد التنفيذ
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <AlertTriangle className="w-3 h-3" />
            معلقة
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400">
            ملغاة
          </span>
        );
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-8 select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>إدارة وتشغيل العقارات والمجمعات والتحصيل السنوي</span>
          </div>
          <h1 className="text-2xl font-bold text-white">إدارة الأملاك والتشغيل العقاري</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            متابعة عمارات ومجمعات الأملاك المسندة للمكتب، تحصيل الإيجارات، ترحيل أرباح المالك، وإدارة أمر الصيانة والتشغيل.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={exportManagedPropertiesToExcel}
            className="px-4 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            title="تصدير كشف إدارة الأملاك إلى Excel"
          >
            <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" />
            <span>تصدير إلى Excel</span>
          </button>

          <button
            onClick={() => setIsAddMaintenanceModalOpen(true)}
            className="px-4 py-3 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-900/20"
          >
            <Wrench className="w-4.5 h-4.5 text-amber-400" />
            <span>أمر صيانة جديد</span>
          </button>

          <button
            onClick={() => setIsAddPropertyModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30 shrink-0"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>تسجيل عقد إدارة أملاك</span>
          </button>
        </div>
      </div>

      {/* Analytics KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Managed Properties */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">عقارات ومجمعات الأملاك</span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">{totalProperties}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>إجمالي {totalUnits} وحدة سكنية وتجارية</span>
            </div>
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">نسبة الإشغال الإجمالية</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-emerald-400">{occupancyRate}%</span>
              <span className="text-xs font-bold text-slate-400">{totalOccupied} / {totalUnits} مؤجرة</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${occupancyRate}%` }}></div>
            </div>
          </div>
        </div>

        {/* Total Office Fees Earned */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">أتعاب أرباح المكتب المستحقة</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-purple-400">{totalOfficeFeesEarned.toLocaleString('ar-SA')} ر.س</div>
            <div className="text-[11px] text-purple-300 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>من تحصيل إجمالي {totalCollectedRevenue.toLocaleString('ar-SA')} ر.س</span>
            </div>
          </div>
        </div>

        {/* Active Maintenance */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">مصروفات الصيانة والتشغيل</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-amber-400">{activeMaintenanceCost.toLocaleString('ar-SA')} ر.س</div>
            <div className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
              <Wrench className="w-3.5 h-3.5" />
              <span>إجمالي {maintenanceTasks.length} أسباب صيانة مسجلة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-800 flex items-center gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('CONTRACTS')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'CONTRACTS'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>عقود الأملاك والمجمعات ({managedProperties.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('MAINTENANCE')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'MAINTENANCE'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>أوامر الصيانة والتشغيل ({maintenanceTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('STATEMENTS')}
          className={`pb-3.5 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'STATEMENTS'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>كشف التحصيل وتحويلات المالك</span>
        </button>
      </div>

      {/* Search Toolbar & Filter Controls */}
      <div className="p-4 rounded-2xl glass-panel flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="بحث باسم العقار، المالك، رقم العقد، الفني، أو الملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0 font-medium">
            <Filter className="w-3.5 h-3.5 text-sky-400" />
            التصفية:
          </span>
          {activeTab === 'CONTRACTS' && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">جميع التصانيف</option>
              <option value="Residential">سكني</option>
              <option value="Commercial">تجاري</option>
              <option value="Mixed">مختلط</option>
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="Active">نشط</option>
            <option value="Completed">مكتمل</option>
            <option value="In_Progress">قيد التنفيذ</option>
            <option value="Expired">منتهي</option>
          </select>
        </div>
      </div>

      {/* Tab 1: Managed Property Contracts Table */}
      {activeTab === 'CONTRACTS' && (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800 shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Building className="w-4 h-4 text-sky-400" />
              <span>قائمة عقود إدارة الأملاك والمجمعات ({filteredProperties.length})</span>
            </h3>
          </div>

          {filteredProperties.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Building className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="font-bold text-white text-sm">لا توجد عقود إدارة أملاك مطابقة للبحث</h4>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">رقم العقد</th>
                    <th className="py-3.5 px-4">العقار / المجمع</th>
                    <th className="py-3.5 px-4">المالك والتواصل</th>
                    <th className="py-3.5 px-4">الوحدات (مؤجرة/شاغرة)</th>
                    <th className="py-3.5 px-4">أتعاب الإدارة</th>
                    <th className="py-3.5 px-4">التحصيل السنوي</th>
                    <th className="py-3.5 px-4">حالة العقد</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredProperties.map((prop) => {
                    const feeAmount =
                      prop.fee_type === 'PERCENTAGE'
                        ? (prop.collected_revenue * prop.fee_value) / 100
                        : prop.fee_value;
                    const netToOwner = Math.max(0, prop.collected_revenue - feeAmount);

                    return (
                      <tr key={prop.id} className="hover:bg-slate-800/40 transition group">
                        <td className="py-3.5 px-4 font-mono font-bold text-sky-400">{prop.contract_number}</td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-sky-400" />
                            <span>{prop.property_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {prop.property_type === 'Residential'
                              ? 'عمارة سكنية'
                              : prop.property_type === 'Commercial'
                              ? 'مجمع تجاري'
                              : 'برج مختلط'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{prop.lessor_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
                            <Phone className="w-3 h-3 text-emerald-400" />
                            <span className="dir-ltr">{prop.lessor_phone}</span>
                            <a
                              href={`https://wa.me/966${prop.lessor_phone.replace(/^0/, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300 transition"
                              title="واتساب المالك"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                              {prop.occupied_units} مؤجرة
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">
                              {prop.vacant_units} شاغرة
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1">من إجمالي {prop.total_units} وحدة</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-purple-400">
                            {prop.fee_type === 'PERCENTAGE' ? `${prop.fee_value}%` : `${prop.fee_value.toLocaleString('ar-SA')} ر.س`}
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            = {feeAmount.toLocaleString('ar-SA')} ر.س للمكتب
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-emerald-400">
                            {prop.collected_revenue.toLocaleString('ar-SA')} ر.س
                          </div>
                          <span className="text-[10px] text-slate-400 block">
                            صافي المالك: {netToOwner.toLocaleString('ar-SA')} ر.س
                          </span>
                        </td>

                        <td className="py-3.5 px-4">{getStatusBadge(prop.status)}</td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setViewingContract(prop)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingContract(prop)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                              title="تعديل العقد"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Property Maintenance Tasks Table */}
      {activeTab === 'MAINTENANCE' && (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800 shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>قائمة أوامر الصيانة والتشغيل ({filteredTasks.length})</span>
            </h3>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Wrench className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="font-bold text-white text-sm">لا توجد أوامر صيانة مطابقة للبحث</h4>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">رقم الأمر</th>
                    <th className="py-3.5 px-4">العقار والوحدة</th>
                    <th className="py-3.5 px-4">نوع الصيانة</th>
                    <th className="py-3.5 px-4">التكلفة (ر.س)</th>
                    <th className="py-3.5 px-4">الفني / المورد المنفذ</th>
                    <th className="py-3.5 px-4">الحالة</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400">{task.task_number}</td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{task.property_name}</div>
                        {task.unit_name && <span className="text-[10px] text-slate-400 block">{task.unit_name}</span>}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-200">{task.maintenance_type}</td>

                      <td className="py-3.5 px-4 font-extrabold text-amber-400">
                        {task.cost_amount.toLocaleString('ar-SA')} ر.س
                      </td>

                      <td className="py-3.5 px-4">
                        {task.contractor_name ? (
                          <div>
                            <div className="font-semibold text-white">{task.contractor_name}</div>
                            {task.contractor_phone && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 dir-ltr text-right">
                                <span>{task.contractor_phone}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 font-normal">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">{getTaskStatusBadge(task.status)}</td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingTask(task)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                            title="تعديل أمر الصيانة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Owner Financial Statements & Office Revenue Breakdown */}
      {activeTab === 'STATEMENTS' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-400" />
              <span>ملخص تحصيل إيجارات الأملاك وكشف أرباح المالك والمكتب</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 block">إجمالي الإيجارات المحصلة</span>
                <span className="text-2xl font-extrabold text-white">
                  {totalCollectedRevenue.toLocaleString('ar-SA')} ر.س
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 block">إجمالي أتعاب إدارة الأملاك للمكتب</span>
                <span className="text-2xl font-extrabold text-purple-400">
                  {totalOfficeFeesEarned.toLocaleString('ar-SA')} ر.س
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400 block">صافي المبالغ المستحقة للترحيل للمُلاك</span>
                <span className="text-2xl font-extrabold text-emerald-400">
                  {totalNetOwnerPayout.toLocaleString('ar-SA')} ر.س
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <NewManagedPropertyModal
        isOpen={isAddPropertyModalOpen}
        onClose={() => setIsAddPropertyModalOpen(false)}
      />

      <EditManagedPropertyModal
        isOpen={!!editingContract}
        onClose={() => setEditingContract(null)}
        contract={editingContract}
      />

      <NewMaintenanceTaskModal
        isOpen={isAddMaintenanceModalOpen}
        onClose={() => setIsAddMaintenanceModalOpen(false)}
      />

      <EditMaintenanceTaskModal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        task={editingTask}
      />
    </div>
  );
}
