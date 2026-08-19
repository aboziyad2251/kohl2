'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Handshake, CheckCircle2 } from 'lucide-react';
import { BrokerageAgreement, Property, Lessor, EjarStatus } from '@/lib/types';

const brokerageSchema = z.object({
  agreement_number: z.string().min(3, 'رقم اتفاقية الوساطة مطلوب'),
  property_id: z.string().min(1, 'اختر العقار'),
  commission_rate: z.number().min(0.1, 'نسبة السعي مطلوب'),
  office_profit: z.number().optional(),
  start_date: z.string().min(1, 'تاريخ البداية مطلوب'),
  expiry_date: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
  ejar_status: z.enum(['Active', 'Pending', 'Cancelled']),
});

type BrokerageInput = z.infer<typeof brokerageSchema>;

interface EditBrokerageModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: BrokerageAgreement | null;
  properties: Property[];
  lessors: Lessor[];
  onSuccess: (updatedAgreement: BrokerageAgreement) => void;
}

export default function EditBrokerageModal({
  isOpen,
  onClose,
  agreement,
  properties,
  lessors,
  onSuccess,
}: EditBrokerageModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BrokerageInput>({
    resolver: zodResolver(brokerageSchema),
  });

  useEffect(() => {
    if (agreement) {
      reset({
        agreement_number: agreement.agreement_number,
        property_id: agreement.property_id,
        commission_rate: agreement.commission_rate,
        office_profit: agreement.office_profit || 0,
        start_date: agreement.start_date,
        expiry_date: agreement.expiry_date,
        ejar_status: agreement.ejar_status,
      });
    }
  }, [agreement, reset]);

  if (!isOpen || !agreement) return null;

  const onSubmit = async (data: BrokerageInput) => {
    setIsSubmitting(true);
    try {
      const prop = properties.find((p) => p.id === data.property_id);

      const updated: BrokerageAgreement = {
        ...agreement,
        agreement_number: data.agreement_number,
        property_id: data.property_id,
        lessor_id: prop?.lessor_id || agreement.lessor_id,
        commission_rate: Number(data.commission_rate),
        office_profit: data.office_profit ? Number(data.office_profit) : 0,
        start_date: data.start_date,
        expiry_date: data.expiry_date,
        ejar_status: data.ejar_status as EjarStatus,
        property: prop,
        lessor: prop?.lessor || agreement.lessor,
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
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل اتفاقية الوساطة العقارية</h3>
              <p className="text-xs text-slate-400">تحديث نسبة السعي وتواريخ الاتفاقية</p>
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
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم الاتفاقية *</label>
            <input
              type="text"
              {...register('agreement_number')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
            />
            {errors.agreement_number && (
              <p className="text-[11px] text-red-400 mt-1">{errors.agreement_number.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">العقار المرتبط *</label>
            <select
              {...register('property_id')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
            >
              <option value="">-- اختر العقار --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.city}) - {p.lessor?.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">نسبة السعي (%) *</label>
              <input
                type="number"
                step="any"
                {...register('commission_rate', { valueAsNumber: true })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1.5">ربح المكتب من الوساطة (ر.س) - يقبل أي مبلغ *</label>
              <input
                type="number"
                step="any"
                {...register('office_profit', { valueAsNumber: true })}
                className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-amber-200 font-bold focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">حالة التوثيق (إيجار) *</label>
            <select
              {...register('ejar_status')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
            >
              <option value="Active">مفعل (Active)</option>
              <option value="Pending">قيد التوثيق (Pending)</option>
              <option value="Cancelled">ملغى (Cancelled)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ البداية *</label>
              <input
                type="date"
                {...register('start_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ الانتهاء *</label>
              <input
                type="date"
                {...register('expiry_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-teal-500 focus:outline-none"
              />
            </div>
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
              className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-teal-500/20"
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
