'use client';

import React from 'react';
import { ArchivedDocument } from '@/lib/types';
import {
  X,
  Printer,
  FileSpreadsheet,
  Building,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface ExportArchiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documents: ArchivedDocument[];
  activeFilterName?: string;
}

const CATEGORY_NAMES: Record<string, string> = {
  CONTRACT: 'عقد إيجار',
  DEED: 'صك ملكية',
  BROKERAGE: 'وساطة وتسويق',
  EPOA: 'وكالة شرعية',
  GENERAL_SERVICE: 'خدمة عامة',
  CUSTOMER_ORDER: 'طلب عميل',
  FINANCIAL: 'معاملة مالية',
  MAINTENANCE: 'أمر صيانة',
  OTHER: 'مستند آخر',
};

export default function ExportArchiveReportModal({
  isOpen,
  onClose,
  documents,
  activeFilterName,
}: ExportArchiveReportModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6 print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none print:my-0">
        {/* Toolbar (hidden on print) */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تصدير تقرير الأرشيف الشامل (PDF)</h3>
              <p className="text-xs text-slate-400">
                تقرير جدولي كامل بالوثائق والمستندات المؤرشفة ({documents.length} وثيقة)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ التقرير كـ PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition mr-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Sheet */}
        <div className="p-8 md:p-10 bg-white text-slate-900 font-sans" dir="rtl">
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500">المملكة العربية السعودية</p>
                <h1 className="text-xl font-black text-slate-900">مكتب كحل لإدارة الأملاك والعقارات</h1>
                <p className="text-xs font-semibold text-sky-700">
                  تقرير سجل الأرشيف الإلكتروني والوثائق المركزية
                </p>
              </div>

              <div className="text-center px-4">
                <div className="w-14 h-14 rounded-2xl border border-slate-300 flex items-center justify-center bg-slate-50 mx-auto mb-1">
                  <Building className="w-7 h-7 text-slate-800" />
                </div>
                <span className="text-[10px] font-extrabold text-slate-600">KOHL ESTATE ERP</span>
              </div>

              <div className="text-left text-xs space-y-1">
                <p>تاريخ الاستخراج: <strong>{new Date().toISOString().split('T')[0]}</strong></p>
                <p>إجمالي الوثائق: <strong className="text-sky-700 text-sm font-mono">{documents.length}</strong></p>
                {activeFilterName && (
                  <p className="text-slate-500">التصنيف المختار: <strong>{activeFilterName}</strong></p>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
                <tr>
                  <th className="p-2.5 text-center">#</th>
                  <th className="p-2.5">كود الأرشيف</th>
                  <th className="p-2.5">عنوان الوثيقة</th>
                  <th className="p-2.5">التصنيف</th>
                  <th className="p-2.5">رقم المرجع</th>
                  <th className="p-2.5">العميل / الجهة</th>
                  <th className="p-2.5">التاريخ</th>
                  <th className="p-2.5 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {documents.map((doc, idx) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="p-2.5 text-center text-slate-500 font-mono">{idx + 1}</td>
                    <td className="p-2.5 font-mono font-bold text-sky-800">{doc.archive_code}</td>
                    <td className="p-2.5 font-semibold text-slate-900">{doc.title}</td>
                    <td className="p-2.5 text-slate-600">{CATEGORY_NAMES[doc.category] || doc.category}</td>
                    <td className="p-2.5 font-mono text-slate-700">{doc.reference_number}</td>
                    <td className="p-2.5 text-slate-800">{doc.client_or_entity}</td>
                    <td className="p-2.5 text-slate-600">{doc.date}</td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        doc.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {doc.status === 'ACTIVE' ? 'ساري' : 'مؤرشف'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer & Signatures */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-6 mt-6">
            <div className="text-xs text-slate-500 space-y-1">
              <p>تم استخراج هذا التقرير آلياً من الأرشيف المركزي المعتمد لمكتب كحل العقاري.</p>
              <p className="text-[10px]">مرخص من شبكة إيجار برقم #88921 • الهيئة العامة للعقار</p>
            </div>

            <div className="flex items-center gap-12 text-center">
              <div>
                <p className="text-xs font-bold text-slate-700 mb-6">مسؤول الأرشيف والتوثيق</p>
                <p className="text-xs text-slate-900 font-serif underline">م. محمد طارق</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 mb-6">الختم المعتمد</p>
                <div className="w-16 h-16 rounded-full border border-dashed border-emerald-700 flex items-center justify-center mx-auto text-[8px] font-bold text-emerald-800">
                  ختم المكتب
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
