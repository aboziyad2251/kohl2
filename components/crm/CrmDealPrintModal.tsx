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
  Handshake,
  TrendingUp,
} from 'lucide-react';
import { CrmDeal, CrmLead, Property } from '@/lib/types';
import { useData } from '@/context/DataContext';

interface CrmDealPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: CrmDeal | null;
  lead?: CrmLead;
  property?: Property;
}

export default function CrmDealPrintModal({
  isOpen,
  onClose,
  deal,
  lead,
  property,
}: CrmDealPrintModalProps) {
  const { archiveProcessRecord } = useData();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  if (!isOpen || !deal) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleArchive = async () => {
    try {
      setIsArchiving(true);
      await archiveProcessRecord({
        title: `ملف صفقة عقارية معتمدة - ${deal.title}`,
        category: 'BROKERAGE',
        referenceNumber: deal.deal_code,
        clientOrEntity: deal.lead_name,
        notes: `صفقة عقارية بقيمة إجمالية ${deal.deal_value.toLocaleString('ar-SA')} ريال، مع سعي ${deal.commission_amount.toLocaleString('ar-SA')} ريال وربح مكتب ${deal.office_profit.toLocaleString('ar-SA')} ريال.`,
        tags: ['CRM', 'صفقة عقارية', 'وساطة وتسويق'],
        sourceModule: 'إدارة علاقات العملاء CRM',
        fileName: `${deal.deal_code}.pdf`,
      });
      setIsArchived(true);
      setTimeout(() => setIsArchived(false), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6 print:border-none print:shadow-none print:bg-white print:w-full print:max-w-none print:my-0">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">وثيقة ملخص الصفقة العقارية الرسمية (PDF)</h3>
              <p className="text-xs text-slate-400">توثيق معتمد لبيانات العميل، العقار، والعمولات للطباعة والأرشفة</p>
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition"
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
                  <p className="text-xs text-slate-600 font-medium">سجل تجاري: 1010899210 | رخصة فال للوساطة: 1200019283</p>
                  <p className="text-[11px] text-slate-500">إدارة علاقات العملاء والتسويق العقاري (CRM)</p>
                </div>
              </div>

              <div className="text-left border-r-2 border-slate-200 pr-4">
                <div className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded inline-block border border-sky-200">
                  ملخص صفقة عقارية
                </div>
                <div className="text-xs font-mono font-bold text-slate-800 mt-2">كود الصفقة: {deal.deal_code}</div>
                <div className="text-xs text-slate-600 mt-0.5">تاريخ الإغلاق المستهدف: {deal.expected_closing_date}</div>
              </div>
            </div>

            {/* Title Banner */}
            <div className="my-6 text-center bg-slate-50 py-3 rounded-xl border border-slate-200">
              <h2 className="text-lg font-extrabold text-slate-900">{deal.title}</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                الوسيط المسؤول: {deal.assigned_agent_name || 'أحمد العتيبي'}
              </p>
            </div>

            {/* Client & Property Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-900 block border-b border-slate-200 pb-1">
                  بيانات العميل والطلب (CRM):
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">اسم العميل:</span>
                  <span className="font-bold text-slate-800">{deal.lead_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">رقم الجوال:</span>
                  <span className="font-mono text-slate-800 dir-ltr">{deal.lead_phone}</span>
                </div>
                {lead && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-500">تصنيف العميل:</span>
                      <span className="font-semibold text-sky-700">{lead.lead_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">المصدر:</span>
                      <span className="text-slate-700">{lead.source}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-900 block border-b border-slate-200 pb-1">
                  بيانات العقار المرتبط:
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">اسم العقار:</span>
                  <span className="font-bold text-slate-800">{deal.property_title || 'فيلا النرجس المودرن'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المدينة / الحي:</span>
                  <span className="text-slate-800">{property?.city || 'الرياض'} - {property?.address || 'حي النرجس'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">نوع العقار:</span>
                  <span className="text-slate-800">{property?.property_type || 'سكني'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">مرحلة الصفقة:</span>
                  <span className="font-semibold text-emerald-700">
                    {deal.stage === 'WON' ? 'تم الفوز وإغلاق الصفقة' : deal.stage === 'NEGOTIATION' ? 'مرحلة التفاوض' : deal.stage}
                  </span>
                </div>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="p-3">البيان المالي</th>
                    <th className="p-3 text-center">النسبة %</th>
                    <th className="p-3 text-left">المبلغ المستحق (ريال سعودي)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-3 font-semibold text-slate-800">قيمة الصفقة الإجمالية (بيع / إيجار سنوي)</td>
                    <td className="p-3 text-center text-slate-500">-</td>
                    <td className="p-3 text-left font-mono font-bold">{deal.deal_value.toLocaleString('ar-SA')} ر.س</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-slate-800">سعي الوساطة العقارية المعتمد</td>
                    <td className="p-3 text-center font-mono font-bold text-sky-700">{deal.commission_rate}%</td>
                    <td className="p-3 text-left font-mono font-bold text-sky-700">{deal.commission_amount.toLocaleString('ar-SA')} ر.س</td>
                  </tr>
                  <tr className="bg-emerald-50/50">
                    <td className="p-3 font-bold text-emerald-950">صافي ربح المكتب العقاري المستهدف</td>
                    <td className="p-3 text-center font-bold text-emerald-800">-</td>
                    <td className="p-3 text-left font-mono font-black text-emerald-700 text-sm">
                      {deal.office_profit.toLocaleString('ar-SA')} ر.س
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {deal.notes && (
              <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-slate-700 mb-6">
                <span className="font-bold text-amber-900 block mb-0.5">ملاحظات وشروط الاتفاق:</span>
                <p>{deal.notes}</p>
              </div>
            )}
          </div>

          {/* Signatures Footer */}
          <div className="pt-6 border-t-2 border-slate-200">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-xs text-slate-500 mb-1">الوسيط العقاري المسؤول</div>
                <div className="text-xs font-bold text-slate-800">{deal.assigned_agent_name || 'أحمد العتيبي'}</div>
                <div className="h-12 flex items-center justify-center text-[10px] text-slate-400 italic">
                  [توقيع الوسيط]
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">ختم المكتب المعتمد</div>
                <div className="w-16 h-16 mx-auto rounded-full border-2 border-dashed border-sky-800 flex flex-col items-center justify-center text-sky-900 font-bold text-[8px] p-1">
                  <span>مكتب الكحل</span>
                  <span>قسم الـ CRM</span>
                  <span className="text-[7px] text-slate-500">معتمد</span>
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">إشعار الطرف المستفيد</div>
                <div className="text-xs font-bold text-slate-800">{deal.lead_name}</div>
                <div className="h-12 flex items-center justify-center text-[10px] text-slate-400 italic">
                  [موافقة وتوقيع]
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
