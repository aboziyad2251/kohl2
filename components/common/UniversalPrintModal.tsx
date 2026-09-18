'use client';

import React, { useRef } from 'react';
import {
  X,
  Printer,
  FileCheck,
  Building,
  ShieldCheck,
  QrCode,
  FolderArchive,
  CheckCircle2,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { ArchivedDocumentCategory } from '@/lib/types';

export interface PrintItemDetail {
  label: string;
  value: string | number | React.ReactNode;
  isHighlight?: boolean;
}

interface UniversalPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  documentNumber: string;
  documentDate: string;
  category: ArchivedDocumentCategory;
  categoryLabel: string;
  clientOrPartyName: string;
  partyRoleLabel?: string; // e.g. المستأجر / المشتري / الموظف
  details: PrintItemDetail[];
  financialTotal?: {
    label: string;
    amount: number;
    currency?: string;
  };
  notes?: string;
  sourceModule: string;
  tags?: string[];
  onArchiveSuccess?: () => void;
}

export default function UniversalPrintModal({
  isOpen,
  onClose,
  title,
  subtitle,
  documentNumber,
  documentDate,
  category,
  categoryLabel,
  clientOrPartyName,
  partyRoleLabel = 'الطرف المعني',
  details,
  financialTotal,
  notes,
  sourceModule,
  tags = [],
  onArchiveSuccess,
}: UniversalPrintModalProps) {
  const { archiveProcessRecord } = useData();
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [isArchivedDone, setIsArchivedDone] = React.useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleArchive = async () => {
    try {
      setIsArchiving(true);
      await archiveProcessRecord({
        title: `${title} - ${clientOrPartyName}`,
        category,
        referenceNumber: documentNumber,
        clientOrEntity: clientOrPartyName,
        notes: notes || `تمت الأرشفة التلقائية بعد اكتمال المعاملة برقم مرجعي ${documentNumber}`,
        tags: [...tags, sourceModule, 'أرشيف موثق'],
        sourceModule,
        fileName: `${documentNumber}.pdf`,
      });
      setIsArchivedDone(true);
      if (onArchiveSuccess) onArchiveSuccess();
      setTimeout(() => {
        setIsArchivedDone(false);
      }, 3500);
    } catch (e) {
      console.error('Archiving error:', e);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6 print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none print:my-0">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">معاينة وتصدير الوثيقة الرسمية (PDF)</h3>
              <p className="text-xs text-slate-400">
                جاهز للطباعة الفورية أو الحفظ كملف PDF معتمد مع إمكانية الترحيل للأرشيف
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Send to Archive Button */}
            <button
              onClick={handleArchive}
              disabled={isArchiving || isArchivedDone}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-md ${
                isArchivedDone
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
              }`}
            >
              {isArchivedDone ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>تم الحفظ بالأرشيف!</span>
                </>
              ) : (
                <>
                  <FolderArchive className="w-4 h-4 text-indigo-400" />
                  <span>{isArchiving ? 'جارٍ الأرشفة...' : 'إرسال إلى الأرشيف'}</span>
                </>
              )}
            </button>

            {/* Print Trigger Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 md:p-12 bg-white text-slate-900 print:p-0 min-h-[600px] flex flex-col justify-between select-text">
          <div>
            {/* Header / Letterhead */}
            <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-2xl shadow">
                  <Building className="w-8 h-8 text-sky-400" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-950 tracking-tight">مكتب الكحل للإدارة العقارية والوساطة</h1>
                  <p className="text-xs text-slate-600 font-medium">سجل تجاري رقم: 1010899210 | رخصة فال العقارية: 1200019283</p>
                  <p className="text-[11px] text-slate-500">المملكة العربية السعودية - الرياض</p>
                </div>
              </div>

              <div className="text-left border-r-2 border-slate-200 pr-4">
                <div className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded inline-block border border-sky-200">
                  {categoryLabel}
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mt-2">رقم الوثيقة: {documentNumber}</div>
                <div className="text-xs text-slate-600 mt-0.5">التاريخ: {documentDate}</div>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="my-6 text-center bg-slate-50 py-3 rounded-xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
              {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
            </div>

            {/* Primary Party Details */}
            <div className="mb-6 p-4 rounded-xl bg-slate-100/70 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-500 font-medium block">{partyRoleLabel}:</span>
                <span className="text-sm font-bold text-slate-900">{clientOrPartyName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">تاريخ الإصدار / التوثيق:</span>
                <span className="text-xs font-semibold text-slate-800">{documentDate}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">الجهة المشرفة:</span>
                <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  منظومة الربط المعتمدة
                </span>
              </div>
            </div>

            {/* Details Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3 w-1/3">البيان / البند</th>
                    <th className="p-3">التفاصيل والقيمة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {details.map((item, idx) => (
                    <tr key={idx} className={item.isHighlight ? 'bg-sky-50/60 font-semibold' : 'hover:bg-slate-50'}>
                      <td className="p-3 text-slate-600 font-medium">{item.label}</td>
                      <td className="p-3 text-slate-900 font-bold">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Total Callout (if available) */}
            {financialTotal && (
              <div className="mb-6 p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">{financialTotal.label}</span>
                  <span className="text-lg font-black text-emerald-400">
                    {financialTotal.amount.toLocaleString('ar-SA')} {financialTotal.currency || 'ريال سعودي'}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-[11px] text-slate-400">شامل كافة الرسوم والضرائب المستحقة</span>
                </div>
              </div>
            )}

            {/* Notes / Conditions */}
            {notes && (
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-slate-700 mb-6">
                <span className="font-bold text-amber-900 block mb-1">ملاحظات واشتراطات:</span>
                <p className="leading-relaxed">{notes}</p>
              </div>
            )}
          </div>

          {/* Signatures & Official Stamp */}
          <div className="pt-8 border-t-2 border-slate-200">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-xs text-slate-500 mb-1">الموظف المسؤول / الوسيط</div>
                <div className="text-xs font-bold text-slate-800">مكتب الكحل العقاري</div>
                <div className="h-16 flex items-center justify-center text-[10px] text-slate-400 italic">
                  [توقيع إلكتروني معتمد]
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">الختم المكتبي المعتمد</div>
                <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-sky-800 flex flex-col items-center justify-center text-sky-900 font-bold text-[9px] shadow-inner p-1">
                  <span>مكتب الكحل</span>
                  <span>للعقارات</span>
                  <span className="text-[8px] text-slate-500">سجل: 1010899210</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">رمز التحقق الإلكتروني</div>
                <div className="w-16 h-16 mx-auto bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center p-1">
                  <QrCode className="w-12 h-12 text-slate-800" />
                </div>
                <div className="text-[9px] text-slate-400 mt-1 font-mono">{documentNumber}</div>
              </div>
            </div>

            <div className="mt-6 text-center text-[10px] text-slate-400">
              وثيقة صادرة إلكترونياً من نظام إدارة المكتب العقاري ومحفوظة في الأرشيف الإلكتروني المشفر.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
