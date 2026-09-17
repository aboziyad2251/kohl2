'use client';

import React, { useRef } from 'react';
import { ArchivedDocument } from '@/lib/types';
import {
  X,
  Printer,
  Download,
  ShieldCheck,
  Building,
  CheckCircle2,
  QrCode,
  FileCheck,
} from 'lucide-react';

interface ArchiveDossierPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: ArchivedDocument | null;
}

const CATEGORY_NAMES: Record<string, string> = {
  CONTRACT: 'عقد إيجار موحد',
  DEED: 'صك ملكية عقاري إلكتروني',
  BROKERAGE: 'اتفاقية وساطة وتسويق عقاري',
  EPOA: 'وكالة شرعية إلكترونية (ناجز)',
  GENERAL_SERVICE: 'معاملة وخدمة حكومية',
  CUSTOMER_ORDER: 'طلب عميل عقاري',
  FINANCIAL: 'سند مالي / تقرير إيرادات',
  MAINTENANCE: 'أمر صيانة وتشغيل عقار',
  OTHER: 'وثيقة رسمية مؤرشفة',
};

export default function ArchiveDossierPrintModal({
  isOpen,
  onClose,
  document: doc,
}: ArchiveDossierPrintModalProps) {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !doc) return null;

  const handleTriggerPrint = () => {
    window.print();
  };

  const categoryLabel = CATEGORY_NAMES[doc.category] || doc.category;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6 print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none print:my-0">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تصدير وثيقة الأرشيف الرسمية (PDF)</h3>
              <p className="text-xs text-slate-400">
                ملف توثيق معتمد وجاهز للطباعة أو الحفظ كـ PDF بترويسة وختم رسمي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerPrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ كملف PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition mr-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official A4 Dossier Document */}
        <div
          ref={printAreaRef}
          id="official-dossier-print"
          className="p-8 md:p-12 bg-white text-slate-900 font-sans leading-normal selection:bg-slate-200"
          dir="rtl"
        >
          {/* Document Official Header */}
          <div className="border-b-2 border-slate-800 pb-6 mb-6">
            <div className="flex items-center justify-between">
              {/* Right: Office Identity */}
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500 tracking-wider">المملكة العربية السعودية</p>
                <h1 className="text-xl font-black text-slate-900">مكتب كحل لإدارة الأملاك والعقارات</h1>
                <p className="text-xs font-semibold text-emerald-700">
                  منظومة الوساطة والتوثيق العقاري المعتمد
                </p>
                <p className="text-[11px] text-slate-500">ترخيص شبكة إيجار رقم: #88921 • س.ت: 1010293847</p>
              </div>

              {/* Center: Official Logo Mark */}
              <div className="flex flex-col items-center justify-center px-4">
                <div className="w-16 h-16 rounded-2xl border-2 border-slate-900 flex items-center justify-center bg-slate-50 mb-1 shadow-sm">
                  <Building className="w-8 h-8 text-slate-800" />
                </div>
                <span className="text-[10px] font-extrabold text-slate-600 tracking-widest">KOHL ESTATE</span>
              </div>

              {/* Left: Document Metadata & QR */}
              <div className="text-left space-y-1">
                <div className="w-16 h-16 border border-slate-300 rounded-lg p-1 bg-slate-50 flex items-center justify-center ml-auto">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800" fill="currentColor">
                    <path d="M10 10h30v30H10zm5 5v20h20V15zm45-5h30v30H60zm5 5v20h20V15zM10 60h30v30H10zm5 5v20h20V65zm45 0h10v10H60zm10 10h10v10H70zm10-10h10v10H80zm0 10h10v10H80zm-20 10h10v10H60zm30 0h10v10H90z" />
                  </svg>
                </div>
                <p className="text-[11px] font-mono text-slate-600 text-left">
                  كود: <strong className="text-slate-900">{doc.archive_code}</strong>
                </p>
                <p className="text-[11px] text-slate-500 text-left">
                  تاريخ الأرشفة: <strong>{doc.date}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Title Ribbon */}
          <div className="bg-slate-900 text-white text-center py-2.5 px-4 rounded-xl mb-6 shadow-sm flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 tracking-wider">سجل الأرشيف المركزي</span>
            <h2 className="text-base font-extrabold tracking-wide">
              وثيقة أرشفة وتوثيق إلكتروني معتمدة
            </h2>
            <span className="text-xs font-bold text-emerald-400">حالة: {doc.status === 'ACTIVE' ? 'ساري' : 'مؤرشف'}</span>
          </div>

          {/* Main Information Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden mb-6">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">بيانات الوثيقة الرئيسية</span>
              <span className="text-xs text-slate-500 font-mono">رقم المرجع: {doc.reference_number}</span>
            </div>

            <div className="grid grid-cols-2 text-xs divide-x divide-y divide-slate-200 divide-x-reverse">
              <div className="p-3 bg-white">
                <span className="text-slate-500 block mb-1">عنوان الوثيقة:</span>
                <span className="font-bold text-slate-900 text-sm">{doc.title}</span>
              </div>
              <div className="p-3 bg-white">
                <span className="text-slate-500 block mb-1">التصنيف النظامي:</span>
                <span className="font-bold text-slate-900">{categoryLabel}</span>
              </div>
              <div className="p-3 bg-white">
                <span className="text-slate-500 block mb-1">الطرف المعني / العميل:</span>
                <span className="font-bold text-slate-900 text-sm">{doc.client_or_entity}</span>
              </div>
              <div className="p-3 bg-white">
                <span className="text-slate-500 block mb-1">رقم الوثيقة / الصك / العقد:</span>
                <span className="font-bold font-mono text-slate-900 text-sm">{doc.reference_number}</span>
              </div>
              <div className="p-3 bg-white">
                <span className="text-slate-500 block mb-1">تاريخ الإصدار / التوثيق:</span>
                <span className="font-bold text-slate-900">{doc.date}</span>
              </div>
              <div className="p-3 bg-white">
                <span className="text-slate-500 block mb-1">الملف الرقمي المرفق:</span>
                <span className="font-bold text-slate-900">
                  {doc.file_name ? `${doc.file_name} (${((doc.file_size || 0) / 1024).toFixed(1)} ك.ب)` : 'مؤرشفة كبيانات وسجلات إلكترونية'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes & Description */}
          {doc.notes && (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 mb-6">
              <h4 className="text-xs font-bold text-slate-700 mb-1.5">ملاحظات وبيانات السجل:</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{doc.notes}</p>
            </div>
          )}

          {/* Tags */}
          {doc.tags && doc.tags.length > 0 && (
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xs text-slate-500 font-semibold">الوسوم:</span>
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Legal Certification Statement */}
          <div className="border-t border-b border-slate-200 py-3 mb-8 text-[11px] text-slate-600 leading-relaxed text-justify bg-slate-50/50 px-4 rounded-lg">
            <strong>إقرار التوثيق:</strong> تشهد إدارة مكتب كحل العقاري بأن هذه الوثيقة تم تقييدها وأرشفتها رقمياً في سجلات المنظومة وفقاً للأنظمة واللوائح العقارية المعمول بها في المملكة العربية السعودية، وتحمل كامل المرجعية القانونية والتنظيمية لمراجعة أطراف العلاقة والجهات المختصة.
          </div>

          {/* Official Signatures & Stamp Block */}
          <div className="grid grid-cols-2 gap-8 pt-4">
            <div className="text-center space-y-3">
              <p className="text-xs font-bold text-slate-700">توقيع المسؤول المعتمد</p>
              <div className="h-16 flex items-center justify-center">
                <span className="font-serif italic text-lg text-slate-800 underline decoration-slate-400">
                  م. محمد طارق الغامدي
                </span>
              </div>
              <p className="text-[10px] text-slate-500">مدير الأرشيف والتوثيق العقاري</p>
            </div>

            <div className="text-center space-y-3">
              <p className="text-xs font-bold text-slate-700">الختم الرسمي للمكتب</p>
              <div className="h-20 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-emerald-800 flex flex-col items-center justify-center p-1 transform rotate-[-6deg]">
                  <span className="text-[8px] font-bold text-emerald-900">مكتب كحل العقاري</span>
                  <span className="text-[7px] font-mono text-emerald-800">معتمد #88921</span>
                  <span className="text-[9px] font-extrabold text-emerald-950">توثيق رسمي</span>
                  <span className="text-[7px] text-emerald-800">جدة - المملكة</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">ختم صالح بدون كشط أو تعديل</p>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
            <span>منظومة إدارة المكتب العقاري • kohl.kohlestate-ksa.online</span>
            <span>طبع بواسطة المستخدم بتاريخ: {new Date().toLocaleDateString('ar-SA')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
