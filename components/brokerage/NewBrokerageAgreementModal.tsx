'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, FileCheck, CheckCircle2, Percent } from 'lucide-react';
import { brokerageAgreementSchema, BrokerageAgreementInput } from '@/lib/validations';
import { Property, BrokerageAgreement } from '@/lib/types';

interface NewBrokerageAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onSuccess: (newAgreement: BrokerageAgreement) => void;
}

export default function NewBrokerageAgreementModal({
  isOpen,
  onClose,
  properties,
  onSuccess,
}: NewBrokerageAgreementModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrokerageAgreementInput>({
    resolver: zodResolver(brokerageAgreementSchema),
    defaultValues: {
      commission_rate: 2.5,
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: BrokerageAgreementInput) => {
    setIsSubmitting(true);
    try {
      const prop = properties.find((p) => p.id === data.property_id);

      const newAgreement: BrokerageAgreement = {
        id: `brk-${Date.now()}`,
        agreement_number: `EJAR-BRK-2026-${Math.floor(100 + Math.random() * 900)}`,
        property_id: data.property_id,
        lessor_id: prop?.lessor_id || '',
        commission_rate: Number(data.commission_rate),
        office_profit: data.office_profit ? Number(data.office_profit) : 0,
        start_date: data.start_date,
        expiry_date: data.expiry_date,
        ejar_status: 'Active',
        file_url: data.file_url || '/docs/sample_brokerage.pdf',
        property: prop,
        lessor: prop?.lessor,
        created_at: new Date().toISOString(),
      };

      onSuccess(newAgreement);
      reset();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">إنشاء اتفاقية وساطة عقارية (إيجار)</h3>
              <p className="text-xs text-slate-400">ربط العقار والمؤجر وتحديد نسبة السعي وربح المكتب المعتمد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Select Property */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">اختر العقار المرتبط بالاتفاقية *</label>
            <select
              {...register('property_id')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
            >
              <option value="">-- اختر العقار --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} - المالك: {p.lessor?.name}
                </option>
              ))}
            </select>
            {errors.property_id && (
              <p className="text-[11px] text-red-400 mt-1">{errors.property_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Commission Rate */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">نسبة السعي / السعي المتفق عليه (%) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="2.5"
                  {...register('commission_rate', { valueAsNumber: true })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-3 pl-8 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
                />
                <Percent className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
              {errors.commission_rate && (
                <p className="text-[11px] text-red-400 mt-1">{errors.commission_rate.message}</p>
              )}
            </div>

            {/* Office Profit */}
            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1.5">ربح المكتب (ر.س) - يقبل أي مبلغ *</label>
              <input
                type="number"
                step="any"
                placeholder="أدخل أي مبلغ (مثال: 175 أو 5000)"
                {...register('office_profit', { valueAsNumber: true })}
                className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-amber-200 font-bold focus:border-amber-400 focus:outline-none"
              />
              <p className="text-[10px] text-amber-400/80 mt-1">يُحسب مباشرة في الأرباح اليومية للمكتب.</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ بدء الاتفاقية *</label>
              <input
                type="date"
                {...register('start_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
              {errors.start_date && (
                <p className="text-[11px] text-red-400 mt-1">{errors.start_date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ انتهاء الاتفاقية *</label>
              <input
                type="date"
                {...register('expiry_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
              {errors.expiry_date && (
                <p className="text-[11px] text-red-400 mt-1">{errors.expiry_date.message}</p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
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
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-teal-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الاعتماد...' : 'حفظ واعتماد الاتفاقية'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
