'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, FileSignature, CheckCircle2 } from 'lucide-react';
import { Contract, Property, Lessor, ContractStatus, PaymentSchedule, ContractType } from '@/lib/types';

const contractSchema = z.object({
  contract_number: z.string().min(3, 'رقم العقد مطلوب'),
  type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'SUBLEASE']),
  property_id: z.string().min(1, 'اختر العقار'),
  tenant_name: z.string().min(3, 'اسم المستأجر مطلوب'),
  tenant_national_id: z.string().min(8, 'الهوية الوطنية مطلوبة'),
  rent_amount: z.number().min(100, 'مبلغ الإيجار مطلوب'),
  total_collected_amount: z.number().optional(),
  office_profit: z.number().optional(),
  security_deposit_amount: z.number().optional(),
  lessor_requirements: z.string().optional(),
  payment_schedule: z.enum(['Monthly', 'Quarterly', 'Semi-Annual', 'Annual']),
  start_date: z.string().min(1, 'تاريخ البداية مطلوب'),
  end_date: z.string().min(1, 'تاريخ النهاية مطلوب'),
  status: z.enum(['Draft', 'Active', 'Terminated', 'Expired']),
  business_activity: z.string().optional(),
  vat_number: z.string().optional(),
});

type ContractInput = z.infer<typeof contractSchema>;

interface EditContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: Contract | null;
  properties: Property[];
  lessors: Lessor[];
  onSuccess: (updatedContract: Contract) => void;
}

export default function EditContractModal({
  isOpen,
  onClose,
  contract,
  properties,
  lessors,
  onSuccess,
}: EditContractModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContractInput>({
    resolver: zodResolver(contractSchema),
  });

  useEffect(() => {
    if (contract) {
      reset({
        contract_number: contract.contract_number,
        type: contract.type,
        property_id: contract.property_id,
        tenant_name: contract.tenant_name,
        tenant_national_id: contract.tenant_national_id,
        rent_amount: contract.rent_amount,
        total_collected_amount: contract.total_collected_amount || contract.rent_amount,
        office_profit: contract.office_profit || 0,
        security_deposit_amount: contract.security_deposit_amount || undefined,
        lessor_requirements: contract.lessor_requirements || '',
        payment_schedule: contract.payment_schedule,
        start_date: contract.start_date,
        end_date: contract.end_date,
        status: contract.status,
        business_activity: contract.business_activity || '',
        vat_number: contract.vat_number || '',
      });
    }
  }, [contract, reset]);

  if (!isOpen || !contract) return null;

  const onSubmit = async (data: ContractInput) => {
    setIsSubmitting(true);
    try {
      const prop = properties.find((p) => p.id === data.property_id);

      const updated: Contract = {
        ...contract,
        contract_number: data.contract_number,
        type: data.type as ContractType,
        property_id: data.property_id,
        lessor_id: prop?.lessor_id || contract.lessor_id,
        tenant_name: data.tenant_name,
        tenant_national_id: data.tenant_national_id,
        rent_amount: Number(data.rent_amount),
        total_collected_amount: data.total_collected_amount ? Number(data.total_collected_amount) : Number(data.rent_amount),
        office_profit: data.office_profit ? Number(data.office_profit) : 0,
        security_deposit_amount: data.security_deposit_amount ? Number(data.security_deposit_amount) : undefined,
        lessor_requirements: data.lessor_requirements || undefined,
        payment_schedule: data.payment_schedule as PaymentSchedule,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status as ContractStatus,
        business_activity: data.business_activity || undefined,
        vat_number: data.vat_number || undefined,
        property: prop,
        lessor: prop?.lessor || contract.lessor,
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل بيانات عقد الإيجار</h3>
              <p className="text-xs text-slate-400">تحديث تفاصيل العقد والقيمة الإيجارية والمستأجر</p>
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم العقد *</label>
              <input
                type="text"
                {...register('contract_number')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              {errors.contract_number && (
                <p className="text-[11px] text-red-400 mt-1">{errors.contract_number.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">نوع العقد *</label>
              <select
                {...register('type')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="RESIDENTIAL">عقد سكني</option>
                <option value="COMMERCIAL">عقد تجاري</option>
                <option value="SUBLEASE">عقد من الباطن</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">العقار المرتبط *</label>
            <select
              {...register('property_id')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="">-- اختر العقار --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.city}) - المالك: {p.lessor?.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم المستأجر *</label>
              <input
                type="text"
                {...register('tenant_name')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              {errors.tenant_name && (
                <p className="text-[11px] text-red-400 mt-1">{errors.tenant_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">الهوية / السجل للمستأجر *</label>
              <input
                type="text"
                {...register('tenant_national_id')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              {errors.tenant_national_id && (
                <p className="text-[11px] text-red-400 mt-1">{errors.tenant_national_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">الإيجار السنوي (ر.س) *</label>
              <input
                type="number"
                {...register('rent_amount', { valueAsNumber: true })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">جدول الدفعات *</label>
              <select
                {...register('payment_schedule')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="Monthly">شهري (12 دفعة)</option>
                <option value="Quarterly">ربع سنوي (4 دفعات)</option>
                <option value="Semi-Annual">نصف سنوي (دفعتان)</option>
                <option value="Annual">سنوي (دفعة واحدة)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">المستقطع الإجمالي (تحصيل المالك) ر.س</label>
              <input
                type="number"
                step="any"
                {...register('total_collected_amount', { valueAsNumber: true })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-amber-300 mb-1">ربح المكتب من العقد (ر.س) - يقبل أي مبلغ *</label>
              <input
                type="number"
                step="any"
                {...register('office_profit', { valueAsNumber: true })}
                className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-amber-200 font-bold focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">مبلغ التأمين المسترد (إن وجد) ر.س</label>
              <input
                type="number"
                step="any"
                {...register('security_deposit_amount', { valueAsNumber: true })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">طلب وشروط من المؤجر</label>
              <input
                type="text"
                {...register('lessor_requirements')}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ البداية *</label>
              <input
                type="date"
                {...register('start_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ النهاية *</label>
              <input
                type="date"
                {...register('end_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">حالة العقد *</label>
              <select
                {...register('status')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="Active">نشط (Active)</option>
                <option value="Draft">مسودة (Draft)</option>
                <option value="Expired">منتهي (Expired)</option>
                <option value="Terminated">ملغى (Terminated)</option>
              </select>
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
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
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
