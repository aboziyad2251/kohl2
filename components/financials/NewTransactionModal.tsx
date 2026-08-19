'use client';

import React, { useState } from 'react';
import { X, DollarSign, PlusCircle, ArrowUpRight, ArrowDownRight, Calculator } from 'lucide-react';
import {
  FinancialTransaction,
  FlowType,
  TransactionType,
  Property,
  Contract,
  BrokerageAgreement,
} from '@/lib/types';
import { calculateTransactionNet } from '@/lib/services/financials';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (transaction: FinancialTransaction) => void;
  properties: Property[];
  contracts: Contract[];
  brokerageAgreements: BrokerageAgreement[];
}

export default function NewTransactionModal({
  isOpen,
  onClose,
  onSubmit,
  properties,
  contracts,
  brokerageAgreements,
}: NewTransactionModalProps) {
  const [flowType, setFlowType] = useState<FlowType>('INCOME');
  const [transactionType, setTransactionType] = useState<TransactionType>('BROKERAGE_COMMISSION');
  const [grossAmount, setGrossAmount] = useState<number>(0);
  const [vatAmount, setVatAmount] = useState<number>(0);
  const [propertyId, setPropertyId] = useState<string>('');
  const [contractId, setContractId] = useState<string>('');
  const [brokerageId, setBrokerageId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');

  if (!isOpen) return null;

  // Compute calculated net amount dynamically
  const computedNet = calculateTransactionNet(flowType, grossAmount, vatAmount);

  const handleApplyVat15 = () => {
    const calculatedVat = Number((grossAmount * 0.15).toFixed(2));
    setVatAmount(calculatedVat);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!grossAmount || grossAmount <= 0) {
      alert('يرجى إدخال مبلغ إجمالي صحيح أكبر من صفر');
      return;
    }

    const selectedProperty = properties.find((p) => p.id === propertyId);
    const selectedContract = contracts.find((c) => c.id === contractId);
    const selectedBrokerage = brokerageAgreements.find((b) => b.id === brokerageId);

    const newTx: FinancialTransaction = {
      id: `ft-${Date.now()}`,
      transaction_date: transactionDate,
      transaction_type: transactionType,
      flow_type: flowType,
      gross_amount: Number(grossAmount),
      tax_vat_amount: Number(vatAmount),
      net_amount: computedNet,
      property_id: propertyId || undefined,
      contract_id: contractId || undefined,
      brokerage_agreement_id: brokerageId || undefined,
      notes: notes.trim() || undefined,
      property: selectedProperty,
      contract: selectedContract,
      brokerage_agreement: selectedBrokerage,
      created_at: new Date().toISOString(),
    };

    onSubmit(newTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">تسجيل معاملة مالية جديدة</h2>
              <p className="text-xs text-slate-400">تسجيل الإيرادات والمصروفات اليومية للدفتر المالي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Flow Type Selection (INCOME vs EXPENSE) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">نوع التدفق المالي</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setFlowType('INCOME');
                  setTransactionType('BROKERAGE_COMMISSION');
                }}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition ${
                  flowType === 'INCOME'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>إيراد مقبوض (+)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFlowType('EXPENSE');
                  setTransactionType('OPERATING_EXPENSE');
                }}
                className={`p-3.5 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition ${
                  flowType === 'EXPENSE'
                    ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/10'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>مصروف مدفوع (-)</span>
              </button>
            </div>
          </div>

          {/* Transaction Type & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">تصنيف المعاملة</label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as TransactionType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                {flowType === 'INCOME' ? (
                  <>
                    <option value="BROKERAGE_COMMISSION">عمولة وساطة عقارية (إيجار)</option>
                    <option value="RENTAL_PAYMENT">دفعة إيجارية محصلة</option>
                    <option value="DOCUMENT_FEE">رسوم توثيق عقود خدمات</option>
                    <option value="MANAGEMENT_FEE">رسوم إدارة وأمانة الأملاك</option>
                  </>
                ) : (
                  <>
                    <option value="OPERATING_EXPENSE">مصروفات تشغيل وإدارة مكتبية</option>
                    <option value="MAINTENANCE_COST">تكاليف صيانة وترميم المباني</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">تاريخ المعاملة</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                required
              />
            </div>
          </div>

          {/* Amounts & Tax */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  المبلغ الإجمالي (شامل الضريبة إن وجدت) - ر.س
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={grossAmount || ''}
                  onChange={(e) => setGrossAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    مبلغ ضريبة القيمة المضافة (VAT)
                  </label>
                  <button
                    type="button"
                    onClick={handleApplyVat15}
                    className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <Calculator className="w-3 h-3" />
                    حساب 15%
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={vatAmount || ''}
                  onChange={(e) => setVatAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Computed Net Preview Banner */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">صافي التدفق المالي المحسوب (Net Amount):</span>
              <span
                className={`text-base font-extrabold ${
                  flowType === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {flowType === 'INCOME' ? '+' : '-'}
                {computedNet.toLocaleString('ar-SA')} ر.س
              </span>
            </div>
          </div>

          {/* Revenue Source (Contract / Brokerage Agreement) - Required for Income */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-sky-400">
                مورد الإيرادات والأرباح (العقد أو اتفاقية الوساطة) *
              </label>
              <span className="text-[10px] text-slate-400">جميع أرباح المكتب تتولد من العقود والوساطة</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  📜 عقد إيجار / بيع / أرض / بيت
                </label>
                <select
                  value={contractId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setContractId(id);
                    if (id) {
                      setBrokerageId('');
                      const targetContract = contracts.find((c) => c.id === id);
                      if (targetContract?.property_id) {
                        setPropertyId(targetContract.property_id);
                      }
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="">-- اختر عقد إيجار / بيع --</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      عقد #{c.contract_number} ({c.type}) - {c.tenant_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  🤝 اتفاقية وساطة عقارية (إيجار)
                </label>
                <select
                  value={brokerageId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setBrokerageId(id);
                    if (id) {
                      setContractId('');
                      const targetBrokerage = brokerageAgreements.find((b) => b.id === id);
                      if (targetBrokerage?.property_id) {
                        setPropertyId(targetBrokerage.property_id);
                      }
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- اختر اتفاقية وساطة --</option>
                  {brokerageAgreements.map((b) => (
                    <option key={b.id} value={b.id}>
                      اتفاقية وساطة #{b.agreement_number} ({b.commission_rate}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">العقار المرتبط بالتلقائي</label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="">-- حدد العقار إن وجد --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.city}) - المالك: {p.lessor?.name || 'مسجل'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">ملاحظات وبيانات إضافية</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب وصف المعاملة المالية أو رقم العملية التحويلية..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span>حفظ المعاملة المالية</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
