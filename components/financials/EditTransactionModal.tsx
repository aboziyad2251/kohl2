'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, DollarSign, CheckCircle2 } from 'lucide-react';
import { FinancialTransaction, Property, Contract, BrokerageAgreement, TransactionType, FlowType } from '@/lib/types';

const txSchema = z.object({
  transaction_date: z.string().min(1, 'تاريخ المعاملة مطلوب'),
  transaction_type: z.enum([
    'BROKERAGE_COMMISSION',
    'RENTAL_PAYMENT',
    'DOCUMENT_FEE',
    'MANAGEMENT_FEE',
    'OPERATING_EXPENSE',
    'MAINTENANCE_COST',
  ]),
  flow_type: z.enum(['INCOME', 'EXPENSE']),
  gross_amount: z.number().min(1, 'المبلغ الإجمالي مطلوب'),
  property_id: z.string().optional(),
  contract_id: z.string().optional(),
  brokerage_agreement_id: z.string().optional(),
  notes: z.string().optional(),
});

type TxInput = z.infer<typeof txSchema>;

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: FinancialTransaction | null;
  properties: Property[];
  contracts: Contract[];
  brokerageAgreements: BrokerageAgreement[];
  onSuccess: (updatedTx: FinancialTransaction) => void;
}

export default function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  properties,
  contracts,
  brokerageAgreements,
  onSuccess,
}: EditTransactionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contractId, setContractId] = useState<string>('');
  const [brokerageId, setBrokerageId] = useState<string>('');
  const [propertyId, setPropertyId] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TxInput>({
    resolver: zodResolver(txSchema),
  });

  const watchFlowType = watch('flow_type') || 'INCOME';
  const watchGross = watch('gross_amount') || 0;

  const vatAmount = watchFlowType === 'INCOME' ? watchGross * 0.15 : 0;
  const netAmount = watchFlowType === 'INCOME' ? watchGross - vatAmount : watchGross;

  useEffect(() => {
    if (transaction) {
      setContractId(transaction.contract_id || '');
      setBrokerageId(transaction.brokerage_agreement_id || '');
      setPropertyId(transaction.property_id || '');
      reset({
        transaction_date: transaction.transaction_date,
        transaction_type: transaction.transaction_type,
        flow_type: transaction.flow_type,
        gross_amount: transaction.gross_amount,
        property_id: transaction.property_id || '',
        contract_id: transaction.contract_id || '',
        brokerage_agreement_id: transaction.brokerage_agreement_id || '',
        notes: transaction.notes || '',
      });
    }
  }, [transaction, reset]);

  if (!isOpen || !transaction) return null;

  const onSubmit = async (data: TxInput) => {
    setIsSubmitting(true);
    try {
      const prop = properties.find((p) => p.id === propertyId);
      const contract = contracts.find((c) => c.id === contractId);
      const brokerage = brokerageAgreements.find((b) => b.id === brokerageId);

      const gross = Number(data.gross_amount);
      const tax = data.flow_type === 'INCOME' ? gross * 0.15 : 0;
      const net = data.flow_type === 'INCOME' ? gross - tax : gross;

      const updated: FinancialTransaction = {
        ...transaction,
        transaction_date: data.transaction_date,
        transaction_type: data.transaction_type as TransactionType,
        flow_type: data.flow_type as FlowType,
        gross_amount: gross,
        tax_vat_amount: tax,
        net_amount: net,
        property_id: propertyId || undefined,
        contract_id: contractId || undefined,
        brokerage_agreement_id: brokerageId || undefined,
        notes: data.notes,
        property: prop,
        contract,
        brokerage_agreement: brokerage,
      };

      onSuccess(updated);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل المعاملة المالية</h3>
              <p className="text-xs text-slate-400">تحديث المبلغ، النوع والتفاصيل</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ المعاملة *</label>
              <input
                type="date"
                {...register('transaction_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">مسار التدفق (دخل / مصروف) *</label>
              <select
                {...register('flow_type')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="INCOME">دخل / إيراد (Income)</option>
                <option value="EXPENSE">مصروفات (Expense)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">نوع المعاملة *</label>
            <select
              {...register('transaction_type')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="BROKERAGE_COMMISSION">عمولة وساطة عقارية</option>
              <option value="RENTAL_PAYMENT">دفعة إيجارية سكنية / تجارية</option>
              <option value="MANAGEMENT_FEE">رسوم إدارة أملاك</option>
              <option value="DOCUMENT_FEE">رسوم توثيق صكوك وعقود</option>
              <option value="OPERATING_EXPENSE">مصروفات تشغيلية ومعاملات</option>
              <option value="MAINTENANCE_COST">تكاليف صيانة وتشغيل عقاري</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">المبلغ الإجمالي (ر.س) *</label>
              <input
                type="number"
                step="1"
                {...register('gross_amount', { valueAsNumber: true })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

          {/* Revenue Source (Contract / Brokerage Agreement) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <label className="block text-xs font-bold text-sky-400">
              مورد الإيرادات والأرباح (العقد أو اتفاقية الوساطة) *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">📜 عقد إيجار / بيع</label>
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
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
                <label className="block text-xs font-medium text-slate-300 mb-1">🤝 اتفاقية وساطة عقارية</label>
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
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
              <label className="block text-xs font-medium text-slate-300 mb-1">العقار المرتبط بالتلقائي</label>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="">-- اختر العقار --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.city})
                  </option>
                ))}
              </select>
            </div>
          </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">ملاحظات وبيان المعاملة</label>
            <input
              type="text"
              {...register('notes')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري التعديل...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
