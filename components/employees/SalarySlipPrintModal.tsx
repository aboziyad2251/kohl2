'use client';

import React, { useState } from 'react';
import {
  X,
  Printer,
  FileCheck,
  Building,
  FolderArchive,
  CheckCircle2,
  QrCode,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import { PayrollPayment, Employee } from '@/lib/types';
import { useData } from '@/context/DataContext';

interface SalarySlipPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PayrollPayment | null;
  employee?: Employee;
}

export default function SalarySlipPrintModal({
  isOpen,
  onClose,
  payment,
  employee,
}: SalarySlipPrintModalProps) {
  const { archiveProcessRecord } = useData();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleArchive = async () => {
    try {
      setIsArchiving(true);
      await archiveProcessRecord({
        title: `مسير راتب معتمد - ${payment.employee_name} (${payment.month_year})`,
        category: 'FINANCIAL',
        referenceNumber: payment.payment_number,
        clientOrEntity: payment.employee_name,
        notes: `سند صرف راتب ومستحقات شهر ${payment.month_year} بمبلغ إجمالي صافي ${payment.net_amount.toLocaleString('ar-SA')} ريال.`,
        tags: ['رواتب', 'شؤون موظفين', 'سند صرف'],
        sourceModule: 'الرواتب والدوام',
        fileName: `${payment.payment_number}.pdf`,
      });
      setIsArchived(true);
      setTimeout(() => setIsArchived(false), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsArchiving(false);
    }
  };

  const methodLabel =
    payment.payment_method === 'BANK_TRANSFER'
      ? 'تحويل بنكي مباشر'
      : payment.payment_method === 'CASH'
      ? 'نقداً'
      : 'شيك مصرفي';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6 print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none print:my-0">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">مسير الراتب وسند الصرف الرسمي (PDF)</h3>
              <p className="text-xs text-slate-400">وثيقة إدارية معتمدة قابلة للطباعة والأرشفة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleArchive}
              disabled={isArchiving || isArchived}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                isArchived
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
              }`}
            >
              {isArchived ? (
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

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Body */}
        <div className="p-8 md:p-12 bg-white text-slate-900 print:p-0 min-h-[600px] flex flex-col justify-between select-text">
          <div>
            {/* Letterhead */}
            <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold text-2xl shadow">
                  <Building className="w-8 h-8 text-sky-400" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-950">مكتب الكحل للإدارة العقارية والوساطة</h1>
                  <p className="text-xs text-slate-600 font-medium">سجل تجاري: 1010899210 | رخصة فال العقارية: 1200019283</p>
                  <p className="text-[11px] text-slate-500">إدارة الشؤون المالية والموارد البشرية</p>
                </div>
              </div>

              <div className="text-left border-r-2 border-slate-200 pr-4">
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded inline-block border border-emerald-200">
                  سند صرف مسير رواتب
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mt-2">رقم المسير: {payment.payment_number}</div>
                <div className="text-xs text-slate-600 mt-0.5">تاريخ الصرف: {payment.payment_date}</div>
              </div>
            </div>

            {/* Title Banner */}
            <div className="my-6 text-center bg-slate-50 py-3 rounded-xl border border-slate-200">
              <h2 className="text-base font-extrabold text-slate-900">
                كشف ومسير راتب شهر ({payment.month_year})
              </h2>
            </div>

            {/* Employee Summary Card */}
            <div className="p-4 rounded-xl bg-slate-100/80 border border-slate-200 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">اسم الموظف:</span>
                <span className="font-bold text-slate-900 text-sm">{payment.employee_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">الرقم الوظيفي:</span>
                <span className="font-semibold text-slate-800">{employee?.employee_number || 'EMP-101'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">المسمى الوظيفي:</span>
                <span className="font-semibold text-slate-800">{employee?.job_title || 'وسيط عقاري'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">طريقة التحويل:</span>
                <span className="font-semibold text-sky-700">{methodLabel}</span>
              </div>
            </div>

            {/* Salary Breakdown Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3">عناصر الاستحقاق والاستقطاع</th>
                    <th className="p-3 text-center">النوع</th>
                    <th className="p-3 text-left">المبلغ (ريال سعودي)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-medium text-slate-700">الراتب الأساسي التعاقدي</td>
                    <td className="p-3 text-center text-emerald-600 font-semibold">استحقاق</td>
                    <td className="p-3 text-left font-mono font-bold">{payment.basic_salary.toLocaleString('ar-SA')} ر.س</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-slate-700">البدلات (سكن، مواصلات، اتصالات)</td>
                    <td className="p-3 text-center text-emerald-600 font-semibold">استحقاق</td>
                    <td className="p-3 text-left font-mono font-bold">{payment.allowances.toLocaleString('ar-SA')} ر.س</td>
                  </tr>
                  {payment.commissions > 0 && (
                    <tr className="bg-emerald-50/50">
                      <td className="p-3 font-medium text-emerald-900">عمولات صفقات وإغلاقات عقارية</td>
                      <td className="p-3 text-center text-emerald-600 font-semibold">مكافأة</td>
                      <td className="p-3 text-left font-mono font-bold text-emerald-700">+{payment.commissions.toLocaleString('ar-SA')} ر.س</td>
                    </tr>
                  )}
                  {payment.deductions > 0 && (
                    <tr className="bg-rose-50/50">
                      <td className="p-3 font-medium text-rose-900">استقطاعات / غياب أو سلفيات سابقة</td>
                      <td className="p-3 text-center text-rose-600 font-semibold">استقطاع</td>
                      <td className="p-3 text-left font-mono font-bold text-rose-700">-{payment.deductions.toLocaleString('ar-SA')} ر.س</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Net Amount Banner */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between mb-6">
              <div>
                <span className="text-xs text-slate-400 block">صافي الراتب المستلم والمحول للبنك:</span>
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {payment.net_amount.toLocaleString('ar-SA')} ريال سعودي
                </span>
              </div>
              <div className="text-left text-xs text-slate-300">
                {payment.reference_number && (
                  <div>الرقم المرجعي للعملية: <span className="font-mono text-sky-400">{payment.reference_number}</span></div>
                )}
                <div>حالة التحويل: <span className="text-emerald-400 font-bold">تم الصرف والاعتماد</span></div>
              </div>
            </div>

            {payment.notes && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 mb-6">
                <span className="font-semibold text-slate-800">ملاحظات: </span>
                {payment.notes}
              </div>
            )}
          </div>

          {/* Signatures Footer */}
          <div className="pt-6 border-t-2 border-slate-200">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-xs text-slate-500 mb-1">المحاسب المالي / إعداد</div>
                <div className="text-xs font-bold text-slate-800">الشؤون المالية</div>
                <div className="h-12 flex items-center justify-center text-[10px] text-slate-400 italic">
                  [معتمد مالياً]
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">مدير الموارد البشرية / اعتماد</div>
                <div className="text-xs font-bold text-slate-800">إدارة الموارد البشرية (HR)</div>
                <div className="h-12 flex items-center justify-center text-[10px] text-slate-400 italic">
                  [توقيع إلكتروني معتمد]
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">الختم المالي المعتمد</div>
                <div className="w-16 h-16 mx-auto rounded-full border-2 border-dashed border-emerald-700 flex flex-col items-center justify-center text-emerald-800 font-bold text-[8px] p-1">
                  <span>مكتب الكحل</span>
                  <span>تم الصرف</span>
                  <span className="text-[7px] text-slate-500">{payment.payment_date}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
