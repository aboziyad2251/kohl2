'use client';

import React, { useState, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import {
  ArchivedDocument,
  ArchivedDocumentCategory,
  ArchivedDocumentStatus,
} from '@/lib/types';
import ImportPdfModal from '@/components/archive/ImportPdfModal';
import PdfViewerModal from '@/components/archive/PdfViewerModal';
import ArchiveDossierPrintModal from '@/components/archive/ArchiveDossierPrintModal';
import ExportArchiveReportModal from '@/components/archive/ExportArchiveReportModal';
import * as XLSX from 'xlsx';
import {
  Archive,
  FileText,
  Upload,
  Download,
  Printer,
  Search,
  Filter,
  Plus,
  Eye,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building,
  Tag,
  Calendar,
  Layers,
  FileCheck,
  ShieldCheck,
  Trash2,
  Share2,
  FolderArchive,
  RefreshCw,
} from 'lucide-react';

const CATEGORY_NAMES: Record<string, string> = {
  CONTRACT: 'عقد إيجار موحد',
  DEED: 'صك ملكية إلكتروني',
  BROKERAGE: 'اتفاقية وساطة',
  EPOA: 'وكالة شرعية',
  GENERAL_SERVICE: 'معاملة حكومية',
  CUSTOMER_ORDER: 'طلب عميل',
  FINANCIAL: 'معاملة مالية',
  MAINTENANCE: 'أمر صيانة',
  OTHER: 'مستند آخر',
};

const CATEGORY_BADGES: Record<string, string> = {
  CONTRACT: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  DEED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  BROKERAGE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  EPOA: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  GENERAL_SERVICE: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  CUSTOMER_ORDER: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  FINANCIAL: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  MAINTENANCE: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  OTHER: 'bg-slate-700/50 text-slate-300 border-slate-600',
};

export default function ArchivePage() {
  const {
    archivedDocuments,
    addArchivedDocument,
    deleteArchivedDocument,
    contracts,
    documents: ownershipDocs,
    properties,
    brokerageAgreements,
    ePoas,
    generalServices,
    customerOrders,
    transactions,
  } = useData();

  const [activeTab, setActiveTab] = useState<'MANUAL' | 'SYSTEM_ALL'>('MANUAL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ArchivedDocumentCategory>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | ArchivedDocumentStatus>('ALL');

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ArchivedDocument | null>(null);
  const [dossierDoc, setDossierDoc] = useState<ArchivedDocument | null>(null);

  // Automatically aggregate all system records into virtual archive items
  const systemAggregatedDocs = useMemo<ArchivedDocument[]>(() => {
    const list: ArchivedDocument[] = [];

    // Contracts
    contracts.forEach((c) => {
      const cNum = c.contract_number || '';
      const cId = c.id || Math.random().toString();
      list.push({
        id: `sys-cnt-${cId}`,
        archive_code: `ARC-CNT-${cNum.replace(/\D/g, '').slice(-4) || '101'}`,
        title: `عقد إيجار ${c.contract_type === 'RESIDENTIAL' ? 'سكني' : 'تجاري'} (${cNum || 'جديد'})`,
        category: 'CONTRACT',
        reference_number: cNum || 'بدون رقم',
        client_or_entity: c.tenant_name || 'مستأجر',
        date: c.start_date || '2026-01-01',
        status: c.status === 'Active' ? 'ACTIVE' : 'ARCHIVED',
        notes: `عقد بقيمة سنوية ${(c.total_amount || 0).toLocaleString('ar-SA')} ر.س - دورية السداد: ${c.payment_schedule || ''}`,
        tags: ['إيجار', c.contract_type === 'RESIDENTIAL' ? 'سكني' : 'تجاري'],
        source_module: 'CONTRACTS',
        created_at: c.created_at || new Date().toISOString(),
      });
    });

    // Deeds & Ownership
    ownershipDocs.forEach((d) => {
      const dNum = d.document_number || '';
      const dId = d.id || Math.random().toString();
      list.push({
        id: `sys-deed-${dId}`,
        archive_code: `ARC-DED-${dNum.slice(-4) || '201'}`,
        title: `صك ملكية إلكتروني (${dNum || 'مسجل'})`,
        category: 'DEED',
        reference_number: dNum || 'بدون رقم',
        client_or_entity: d.lessor?.name || 'المالك المسجل',
        date: d.issue_date || '2026-01-01',
        status: 'ACTIVE',
        notes: `صك ملكية موثق في بورصة العقارات والهيئة العامة للعقار.`,
        tags: ['صك إلكتروني', 'عقار'],
        source_module: 'OWNERSHIP',
        created_at: d.created_at || new Date().toISOString(),
      });
    });

    // Brokerage
    brokerageAgreements.forEach((b) => {
      const bNum = b.agreement_number || '';
      const bId = b.id || Math.random().toString();
      list.push({
        id: `sys-brk-${bId}`,
        archive_code: `ARC-BRK-${bNum.slice(-4) || '301'}`,
        title: `اتفاقية وساطة عقارية (${bNum || 'معتمدة'})`,
        category: 'BROKERAGE',
        reference_number: bNum || 'بدون رقم',
        client_or_entity: b.lessor?.name || 'المالك',
        date: b.start_date || '2026-01-01',
        status: b.status === 'Active' ? 'ACTIVE' : 'ARCHIVED',
        notes: `نسبة السعي: %${b.commission_percentage || 0} • مدة الاتفاقية حتى ${b.end_date || ''}`,
        tags: ['وساطة', 'تسويق'],
        source_module: 'BROKERAGE',
        created_at: b.created_at || new Date().toISOString(),
      });
    });

    // E-POAs
    ePoas.forEach((p) => {
      const pNum = p.poa_number || '';
      const pId = p.id || Math.random().toString();
      list.push({
        id: `sys-poa-${pId}`,
        archive_code: `ARC-POA-${pNum.slice(-4) || '401'}`,
        title: `وكالة شرعية إلكترونية (${pNum || 'ناجز'})`,
        category: 'EPOA',
        reference_number: pNum || 'بدون رقم',
        client_or_entity: 'وكالة معتمدة',
        date: p.issue_date || '2026-01-01',
        status: p.status === 'Active' ? 'ACTIVE' : 'EXPIRED',
        notes: `وكالة شرعية رقم ${pNum} صادرة عبر بوابة ناجز.`,
        tags: ['ناجز', 'وكالة'],
        source_module: 'E_POAS',
        created_at: p.created_at || new Date().toISOString(),
      });
    });

    // General Services
    generalServices.forEach((s) => {
      const sNum = s.service_number || '';
      const sId = s.id || Math.random().toString();
      list.push({
        id: `sys-srv-${sId}`,
        archive_code: `ARC-SRV-${sNum.slice(-4) || '501'}`,
        title: s.title || 'معاملة حكومية',
        category: 'GENERAL_SERVICE',
        reference_number: sNum || 'بدون رقم',
        client_or_entity: s.client_name || 'عميل',
        date: s.created_at ? s.created_at.split('T')[0] : '2026-01-01',
        status: s.status === 'Completed' ? 'ARCHIVED' : 'ACTIVE',
        notes: `ربح المكتب: ${(s.office_profit || 0).toLocaleString('ar-SA')} ر.س • التكلفة: ${(s.cost_amount || 0).toLocaleString('ar-SA')} ر.س`,
        tags: ['خدمات عامة', s.category || 'عام'],
        source_module: 'GENERAL_SERVICES',
        created_at: s.created_at || new Date().toISOString(),
      });
    });

    // Customer Orders
    customerOrders.forEach((o) => {
      const oNum = o.order_number || '';
      const oId = o.id || Math.random().toString();
      list.push({
        id: `sys-ord-${oId}`,
        archive_code: `ARC-ORD-${oNum.slice(-4) || '601'}`,
        title: `طلب عميل: ${o.building_type || 'عقار'} (${o.desired_area || 'جدة'})`,
        category: 'CUSTOMER_ORDER',
        reference_number: oNum || 'بدون رقم',
        client_or_entity: o.client_name || 'عميل',
        date: o.created_at ? o.created_at.split('T')[0] : '2026-01-01',
        status: o.status === 'Fulfilled' ? 'ARCHIVED' : 'ACTIVE',
        notes: `الميزانية: ${(o.budget_min || 0).toLocaleString('ar-SA')} - ${(o.budget_max || 0).toLocaleString('ar-SA')} ر.س`,
        tags: ['طلبات عملاء', o.category === 'RESIDENTIAL' ? 'سكني' : 'تجاري'],
        source_module: 'CUSTOMER_ORDERS',
        created_at: o.created_at || new Date().toISOString(),
      });
    });

    return list;
  }, [contracts, ownershipDocs, brokerageAgreements, ePoas, generalServices, customerOrders]);

  // Current active dataset
  const currentDocsList = activeTab === 'MANUAL' ? archivedDocuments : systemAggregatedDocs;

  // Filtered documents
  const filteredDocs = currentDocsList.filter((doc) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      doc.title.toLowerCase().includes(q) ||
      doc.archive_code.toLowerCase().includes(q) ||
      doc.reference_number.toLowerCase().includes(q) ||
      doc.client_or_entity.toLowerCase().includes(q) ||
      (doc.notes && doc.notes.toLowerCase().includes(q)) ||
      (doc.tags && doc.tags.some((t) => t.toLowerCase().includes(q)));

    const matchesCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
    const matchesStatus = selectedStatus === 'ALL' || doc.status === selectedStatus;

    return matchesQuery && matchesCategory && matchesStatus;
  });

  // Metrics
  const totalUploadedPdfs = archivedDocuments.filter((d) => d.file_data_url || d.file_name).length;
  const totalActiveDocs = currentDocsList.filter((d) => d.status === 'ACTIVE').length;
  const totalContractsAndDeeds = currentDocsList.filter(
    (d) => d.category === 'CONTRACT' || d.category === 'DEED'
  ).length;

  // Export to Excel
  const exportToExcel = () => {
    const exportData = filteredDocs.map((doc, idx) => ({
      '#': idx + 1,
      'كود الأرشيف': doc.archive_code,
      'عنوان الوثيقة': doc.title,
      'التصنيف': CATEGORY_NAMES[doc.category] || doc.category,
      'رقم المرجع': doc.reference_number,
      'العميل / الجهة': doc.client_or_entity,
      'التاريخ': doc.date,
      'الحالة': doc.status === 'ACTIVE' ? 'ساري' : 'مؤرشف',
      'اسم ملف PDF': doc.file_name || 'لا يوجد ملف مرفق',
      'الملاحظات': doc.notes || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الأرشيف_الإلكتروني');
    XLSX.writeFile(wb, `سجل_الأرشيف_الإلكتروني_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Main Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              الأرشيف الإلكتروني والوثائق
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                PDF 📂
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              إدارة وأرشفة الصكوك والعقود واستيراد وتصدير ملفات PDF بختم وترويسة معتمدة
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
          >
            <Upload className="w-4 h-4" />
            <span>استيراد وثيقة PDF</span>
          </button>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>تصدير تقرير PDF</span>
          </button>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-400" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Analytics KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">إجمالي الوثائق بالسجل</p>
            <h3 className="text-2xl font-bold text-white mt-1 font-mono">{currentDocsList.length}</h3>
            <p className="text-[10px] text-slate-500 mt-1">وثائق مؤرشفة ومسجلة</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
            <Archive className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">ملفات PDF المرفوعة</p>
            <h3 className="text-2xl font-bold text-white mt-1 font-mono text-cyan-400">
              {totalUploadedPdfs}
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">مستندات رقمية جاهزة للمعاينة</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">صكوك وعقود نظامية</p>
            <h3 className="text-2xl font-bold text-white mt-1 font-mono text-emerald-400">
              {totalContractsAndDeeds}
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">موثقة بشبكة إيجار وبورصة العقار</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">الوثائق السارية والنشطة</p>
            <h3 className="text-2xl font-bold text-white mt-1 font-mono text-amber-400">
              {totalActiveDocs}
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">قيد المتابعة والاعتماد</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('MANUAL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'MANUAL'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>المستندات وملفات PDF المرفوعة ({archivedDocuments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SYSTEM_ALL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'SYSTEM_ALL'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/25'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>الأرشيف الشامل لكافة وثائق المنظومة ({systemAggregatedDocs.length})</span>
        </button>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالكود، العنوان، رقم الصك، أو العميل..."
            className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pr-10 pl-3.5 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">التصنيف:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">جميع التصنيفات</option>
              {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">الحالة:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="ACTIVE">ساري وموثق</option>
              <option value="ARCHIVED">مؤرشف</option>
              <option value="EXPIRED">منتهي</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Documents Table */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-4 text-center w-12">#</th>
                <th className="p-4">كود الأرشيف</th>
                <th className="p-4">عنوان الوثيقة والمستند</th>
                <th className="p-4">التصنيف</th>
                <th className="p-4">رقم المرجع</th>
                <th className="p-4">العميل / الطرف المعني</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4 text-center">الملف / الحالة</th>
                <th className="p-4 text-center w-36">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc, idx) => {
                  const badgeClass = CATEGORY_BADGES[doc.category] || CATEGORY_BADGES.OTHER;
                  const categoryName = CATEGORY_NAMES[doc.category] || doc.category;

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-800/40 transition-colors duration-150 group"
                    >
                      <td className="p-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="p-4">
                        <span className="font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-1 rounded-md border border-sky-500/20 text-[11px]">
                          {doc.archive_code}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-sky-400 transition" />
                          <span>{doc.title}</span>
                        </div>
                        {doc.notes && (
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 max-w-xs font-normal">
                            {doc.notes}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                          {categoryName}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-slate-300">{doc.reference_number}</td>
                      <td className="p-4 text-slate-200 font-medium">{doc.client_or_entity}</td>
                      <td className="p-4 text-slate-400">{doc.date}</td>
                      <td className="p-4 text-center">
                        {doc.file_data_url ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>PDF مرفق</span>
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                            {doc.status === 'ACTIVE' ? 'ساري' : 'مؤرشف'}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Preview / View PDF */}
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            title="معاينة PDF"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-400 border border-slate-700 transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Print / Export Official Dossier PDF */}
                          <button
                            onClick={() => setDossierDoc(doc)}
                            title="تصدير ملف رسمي PDF"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete (only for manually archived items) */}
                          {activeTab === 'MANUAL' && (
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من حذف الوثيقة (${doc.title}) من الأرشيف؟`)) {
                                  deleteArchivedDocument(doc.id);
                                }
                              }}
                              title="حذف من الأرشيف"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    <Archive className="w-12 h-12 mx-auto mb-3 text-slate-600 opacity-50" />
                    <p className="text-sm font-semibold text-slate-300">لا توجد وثائق مطابقة للبحث أو التصفية</p>
                    <p className="text-xs text-slate-500 mt-1">
                      يمكنك استيراد ملفات PDF جديدة أو تغيير معايير البحث
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ImportPdfModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(newDoc) => addArchivedDocument(newDoc)}
      />

      <PdfViewerModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />

      <ArchiveDossierPrintModal
        isOpen={!!dossierDoc}
        onClose={() => setDossierDoc(null)}
        document={dossierDoc}
      />

      <ExportArchiveReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        documents={filteredDocs}
        activeFilterName={selectedCategory !== 'ALL' ? CATEGORY_NAMES[selectedCategory] : undefined}
      />
    </div>
  );
}
