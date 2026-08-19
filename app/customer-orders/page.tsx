'use client';

import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { CustomerOrder, CustomerOrderCategory, CustomerOrderStatus } from '../../lib/types';
import NewCustomerOrderModal from '../../components/customer-orders/NewCustomerOrderModal';
import EditCustomerOrderModal from '../../components/customer-orders/EditCustomerOrderModal';
import ImportCustomerOrdersModal from '../../components/customer-orders/ImportCustomerOrdersModal';
import * as XLSX from 'xlsx';
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Phone,
  User,
  Building2,
  MapPin,
  Coins,
  CheckCircle2,
  Clock,
  XCircle,
  Home,
  Briefcase,
  Edit,
  Eye,
  MessageCircle,
  TrendingUp,
  FileSpreadsheet,
  Upload,
  FileText,
} from 'lucide-react';

export default function CustomerOrdersPage() {
  const { customerOrders, updateCustomerOrder } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'ALL' | CustomerOrderCategory>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | CustomerOrderStatus>('ALL');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<CustomerOrder | null>(null);

  // Filtered Orders
  const filteredOrders = customerOrders.filter((ord) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      ord.client_name.toLowerCase().includes(query) ||
      ord.client_phone.includes(query) ||
      ord.building_type.toLowerCase().includes(query) ||
      ord.desired_area.toLowerCase().includes(query) ||
      ord.order_number.toLowerCase().includes(query) ||
      (ord.notes && ord.notes.toLowerCase().includes(query));

    const matchesCategory = selectedCategoryFilter === 'ALL' || ord.category === selectedCategoryFilter;
    const matchesStatus = selectedStatusFilter === 'ALL' || ord.status === selectedStatusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Analytics Metrics
  const totalOrders = customerOrders.length;
  const activeSearchingCount = customerOrders.filter((o) => o.status === 'Searching' || o.status === 'New').length;
  const residentialCount = customerOrders.filter((o) => o.category === 'RESIDENTIAL').length;
  const commercialCount = customerOrders.filter((o) => o.category === 'COMMERCIAL').length;
  const fulfilledCount = customerOrders.filter((o) => o.status === 'Fulfilled').length;

  const handleQuickStatusChange = async (order: CustomerOrder, newStatus: CustomerOrderStatus) => {
    await updateCustomerOrder({
      ...order,
      status: newStatus,
    });
  };

  // Export Customer Orders to Excel (.xlsx)
  const exportToExcel = () => {
    const ordersToExport = filteredOrders.length > 0 ? filteredOrders : customerOrders;
    
    const excelData = ordersToExport.map((ord, idx) => ({
      '#': idx + 1,
      'رقم الطلب': ord.order_number,
      'اسم العميل': ord.client_name,
      'رقم الجوال': ord.client_phone,
      'التصنيف': ord.category === 'RESIDENTIAL' ? 'سكني' : 'تجاري',
      'نوع العقار المطلوب': ord.building_type,
      'المنطقة والمساحة': ord.desired_area,
      'الميزانية الدنيا (ر.س)': ord.budget_min || 0,
      'الميزانية القصوى (ر.س)': ord.budget_max || 0,
      'حالة الطلب':
        ord.status === 'New'
          ? 'جديد'
          : ord.status === 'Searching'
          ? 'قيد البحث'
          : ord.status === 'Fulfilled'
          ? 'تم التوفير'
          : 'ملغى',
      'الملاحظات والشروط': ord.notes || '',
      'تاريخ التسجيل': ord.created_at ? ord.created_at.split('T')[0] : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Configure Right-To-Left direction for Arabic display
    if (!worksheet['!views']) worksheet['!views'] = [];
    worksheet['!views'].push({ RTL: true });

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },  // #
      { wch: 16 }, // رقم الطلب
      { wch: 25 }, // اسم العميل
      { wch: 15 }, // رقم الجوال
      { wch: 10 }, // التصنيف
      { wch: 22 }, // نوع العقار
      { wch: 35 }, // المنطقة والمساحة
      { wch: 20 }, // الميزانية الدنيا
      { wch: 20 }, // الميزانية القصوى
      { wch: 12 }, // حالة الطلب
      { wch: 40 }, // الملاحظات
      { wch: 15 }, // تاريخ التسجيل
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'طلبات العملاء');

    const fileName = `طلبات_العملاء_العقارية_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const getStatusBadge = (status: CustomerOrderStatus) => {
    switch (status) {
      case 'New':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Clock className="w-3 h-3" />
            جديد
          </span>
        );
      case 'Searching':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Search className="w-3 h-3" />
            قيد البحث
          </span>
        );
      case 'Fulfilled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            تم التوفير
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            ملغى
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Banner & Action Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/70 to-slate-900 border border-sky-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>سجل طلبات واحتياجات العملاء (سكني وتجاري)</span>
          </div>
          <h1 className="text-2xl font-bold text-white">طلبات العملاء العقارية</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            إدارة متابعة الطلبات الواردة من العملاء الباحثين عن عقارات سكنية أو تجارية وتسهيل توفيرها بسرعة.
          </p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-900/20"
            title="رفع واستيراد طلبات عملاء من ملف Excel"
          >
            <Upload className="w-4.5 h-4.5 text-purple-400" />
            <span>استيراد من Excel</span>
          </button>

          <button
            onClick={exportToExcel}
            className="px-4 py-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-900/20"
            title="تصدير قائمة الطلبات إلى ملف Excel"
          >
            <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" />
            <span>تصدير إلى Excel</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30 shrink-0"
          >
            <Plus className="w-4.5 h-4.5" />
            <span>تسجيل طلب عميل جديد</span>
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Orders */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">إجمالي طلبات العملاء</span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-white">{totalOrders}</div>
            <div className="text-[11px] text-sky-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>مسجلة بالنظام</span>
            </div>
          </div>
        </div>

        {/* Active Searching */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">طلبات نشطة قيد البحث</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-amber-400">{activeSearchingCount}</div>
            <div className="text-[11px] text-amber-300 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>بانتظار توفير العقار المناسب</span>
            </div>
          </div>
        </div>

        {/* Residential vs Commercial */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">سكني vs تجاري</span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-sky-400">{residentialCount} سكني</span>
              <span className="text-slate-600">|</span>
              <span className="text-purple-400">{commercialCount} تجاري</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">توزيع طلبات السوق</div>
          </div>
        </div>

        {/* Fulfilled */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">طلبات تم توفيرها بنجاح</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-emerald-400">{fulfilledCount}</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>تم إبرام وتوثيق العقود</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Toolbar & Filter Controls */}
      <div className="p-4 rounded-2xl glass-panel flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            placeholder="بحث بالاسم، الجوال، نوع العقار، الحي، والملاحظات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0 font-medium">
            <Filter className="w-3.5 h-3.5 text-sky-400" />
            التصنيف:
          </span>
          <button
            onClick={() => setSelectedCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              selectedCategoryFilter === 'ALL'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setSelectedCategoryFilter('RESIDENTIAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 ${
              selectedCategoryFilter === 'RESIDENTIAL'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            سكني
          </button>
          <button
            onClick={() => setSelectedCategoryFilter('COMMERCIAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 ${
              selectedCategoryFilter === 'COMMERCIAL'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            تجاري
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 border-t lg:border-t-0 lg:border-r border-slate-800 lg:pr-4">
          <span className="text-xs text-slate-400 shrink-0 font-medium">الحالة:</span>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="New">جديد (New)</option>
            <option value="Searching">قيد البحث (Searching)</option>
            <option value="Fulfilled">تم التوفير (Fulfilled)</option>
            <option value="Cancelled">ملغى (Cancelled)</option>
          </select>
        </div>
      </div>

      {/* Orders Data Table */}
      <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800 shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-sky-400" />
            <span>قائمة طلبات العملاء ({filteredOrders.length})</span>
          </h3>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-sm">لا توجد طلبات مطابقة للبحث</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              لم يتم العثور على أي طلبات عملاء تطابق معايير تصفية البحث المحددة.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">رقم الطلب</th>
                  <th className="py-3.5 px-4">اسم العميل والتواصل</th>
                  <th className="py-3.5 px-4">التصنيف</th>
                  <th className="py-3.5 px-4">نوع العقار المطلوب</th>
                  <th className="py-3.5 px-4">المنطقة والمساحة</th>
                  <th className="py-3.5 px-4">الميزانية المتوقعة</th>
                  <th className="py-3.5 px-4">ملاحظات وتفاصيل إضافية</th>
                  <th className="py-3.5 px-4">حالة الطلب</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-800/40 transition group">
                    {/* Order Number */}
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-400">{ord.order_number}</td>

                    {/* Client Name & Phone */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{ord.client_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        <span className="dir-ltr">{ord.client_phone}</span>
                        <a
                          href={`https://wa.me/966${ord.client_phone.replace(/^0/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 transition"
                          title="تواصل عبر واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>

                    {/* Category (سكني أو تجاري) */}
                    <td className="py-3.5 px-4">
                      {ord.category === 'RESIDENTIAL' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 font-bold text-[11px]">
                          <Home className="w-3 h-3" />
                          سكني
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold text-[11px]">
                          <Briefcase className="w-3 h-3" />
                          تجاري
                        </span>
                      )}
                    </td>

                    {/* Building Type */}
                    <td className="py-3.5 px-4 font-semibold text-slate-100">{ord.building_type}</td>

                    {/* Area & Size */}
                    <td className="py-3.5 px-4 text-slate-300">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{ord.desired_area}</span>
                      </div>
                    </td>

                    {/* Budget Range */}
                    <td className="py-3.5 px-4 font-bold text-emerald-400">
                      {ord.budget_min || ord.budget_max ? (
                        <span>
                          {ord.budget_min ? `${ord.budget_min.toLocaleString('ar-SA')} - ` : ''}
                          {ord.budget_max ? `${ord.budget_max.toLocaleString('ar-SA')} ر.س` : ''}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-normal">غير محدد</span>
                      )}
                    </td>

                    {/* Customer Notes & Special Requirements */}
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs">
                      {ord.notes ? (
                        <div className="flex items-start gap-1.5 p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-200">
                          <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-relaxed" title={ord.notes}>
                            {ord.notes}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 font-normal text-[11px]">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">{getStatusBadge(ord.status)}</td>

                    {/* Actions */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setViewingOrder(ord)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingOrder(ord)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition"
                          title="تعديل الطلب"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {ord.status !== 'Fulfilled' && (
                          <button
                            onClick={() => handleQuickStatusChange(ord, 'Fulfilled')}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition text-[10px] font-bold px-2"
                            title="تحديد كتم التوفير"
                          >
                            إكتمال
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add New Customer Order Modal */}
      <NewCustomerOrderModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      {/* Import Customer Orders Modal */}
      <ImportCustomerOrdersModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      {/* Edit Customer Order Modal */}
      <EditCustomerOrderModal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
      />

      {/* Viewing Order Details Drawer */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">تفاصيل الطلب ({viewingOrder.order_number})</h3>
                  <p className="text-xs text-slate-400">تاريخ التسجيل: {viewingOrder.created_at?.split('T')[0]}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <div>
                  <span className="text-slate-400 block mb-1">اسم العميل</span>
                  <span className="font-bold text-white text-sm">{viewingOrder.client_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">رقم الجوال</span>
                  <span className="font-bold text-emerald-400 text-sm dir-ltr">{viewingOrder.client_phone}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-slate-400 block mb-1">تصنيف العقار</span>
                  <span className="font-bold text-sky-400">
                    {viewingOrder.category === 'RESIDENTIAL' ? 'سكني' : 'تجاري'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-slate-400 block mb-1">نوع العقار</span>
                  <span className="font-bold text-white">{viewingOrder.building_type}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                <span className="text-slate-400 block">المنطقة والمساحة المطلوبة</span>
                <p className="font-bold text-white text-sm">{viewingOrder.desired_area}</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                <span className="text-slate-400 block">الميزانية المتوقعة</span>
                <p className="font-extrabold text-emerald-400 text-sm">
                  {viewingOrder.budget_min || viewingOrder.budget_max ? (
                    <span>
                      {viewingOrder.budget_min ? `${viewingOrder.budget_min.toLocaleString('ar-SA')} - ` : ''}
                      {viewingOrder.budget_max ? `${viewingOrder.budget_max.toLocaleString('ar-SA')} ر.س` : ''}
                    </span>
                  ) : (
                    <span className="text-slate-500 font-normal">غير محدد</span>
                  )}
                </p>
              </div>

              {viewingOrder.notes && (
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block">ملاحظات وشروط خاصة</span>
                  <p className="text-slate-200 leading-relaxed">{viewingOrder.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setViewingOrder(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                إغلاق
              </button>
              <button
                onClick={() => {
                  setEditingOrder(viewingOrder);
                  setViewingOrder(null);
                }}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4" />
                <span>تعديل هذا الطلب</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
