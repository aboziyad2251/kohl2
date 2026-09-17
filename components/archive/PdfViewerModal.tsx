'use client';

import React from 'react';
import { ArchivedDocument } from '@/lib/types';
import {
  X,
  Download,
  Printer,
  FileText,
  Calendar,
  User,
  Hash,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ArchivedDocument | null;
}

export default function PdfViewerModal({
  isOpen,
  onClose,
  document: doc,
}: PdfViewerModalProps) {
  if (!isOpen || !doc) return null;

  const handleDownload = () => {
    if (doc.file_data_url) {
      const link = window.document.createElement('a');
      link.href = doc.file_data_url;
      link.download = doc.file_name || `${doc.archive_code}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } else {
      window.print();
    }
  };

  const handlePrint = () => {
    const iframe = window.document.getElementById('pdf-preview-frame') as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      } catch (e) {
        console.warn('Iframe print restricted, triggering window print:', e);
      }
    }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden">
      <div className="relative w-full max-w-5xl h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">{doc.title}</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                  {doc.archive_code}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                مرجع: {doc.reference_number} • {doc.client_or_entity} • {doc.date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              title="تنزيل الملف"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition"
            >
              <Download className="w-4 h-4 text-sky-400" />
              <span>تنزيل</span>
            </button>
            <button
              onClick={handlePrint}
              title="طباعة"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition mr-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Area */}
        <div className="flex-1 bg-slate-950 p-2 overflow-hidden flex flex-col justify-center items-center relative">
          {doc.file_data_url ? (
            <iframe
              id="pdf-preview-frame"
              src={doc.file_data_url}
              className="w-full h-full rounded-xl border border-slate-800 bg-white"
              title={doc.title}
            />
          ) : (
            <div className="max-w-md text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white">معاينة المستند المؤرشف</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                هذه الوثيقة مؤرشفة رقمياً بسجلات المنظومة برقم مرجعي{' '}
                <span className="text-sky-400 font-mono font-bold">{doc.reference_number}</span>. يمكنك استخراج وتصدير الملف الرسمي كـ PDF متكامل بختم وترويسة معتمدة.
              </p>
              <div className="pt-2">
                <button
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition flex items-center gap-2 mx-auto"
                >
                  <Printer className="w-4 h-4" />
                  <span>تصدير ملف رسمي PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Details */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2 shrink-0">
          <div className="flex items-center gap-4">
            <span>الجهة / العميل: <strong className="text-slate-200">{doc.client_or_entity}</strong></span>
            <span>تاريخ الأرشفة: <strong className="text-slate-200">{doc.date}</strong></span>
            {doc.file_size && (
              <span>الحجم: <strong className="text-slate-200">{(doc.file_size / 1024).toFixed(1)} ك.ب</strong></span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-medium">موثق في سجلات مكتب كحل العقاري</span>
          </div>
        </div>
      </div>
    </div>
  );
}
