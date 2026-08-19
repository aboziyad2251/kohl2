'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Briefcase, CheckCircle2, Trash2 } from 'lucide-react';
import { GeneralService, ServiceCategory, ServiceStatus } from '@/lib/types';

const optionalNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined || Number.isNaN(val) ? 0 : Number(val)),
  z.number().optional()
);

const serviceSchema = z.object({
  client_name: z.string().min(3, 'اسم العميل مطلوب'),
  client_phone: z.string().optional(),
  client_national_id: z.string().optional(),
  category: z.enum(['EJAR', 'BALADY', 'QIWA', 'DEED_SURVEY', 'GOV_TRANSACTION', 'OTHER']),
  title: z.string().min(3, 'اسم الخدمة مطلوب'),
  fee_amount: z.preprocess(
    (val) => (val === '' || val === null || val === undefined || Number.isNaN(val) ? 0 : Number(val)),
    z.number().min(0, 'مبلغ الخدمة مطلوب')
  ),
  cost_amount: optionalNumber,
  office_profit: optionalNumber,
  status: z.enum(['Pending', 'In_Progress', 'Completed', 'Cancelled']),
  notes: z.string().optional(),
});

type ServiceInput = z.infer<typeof serviceSchema>;

interface EditGeneralServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: GeneralService | null;
  onSuccess: (updatedService: GeneralService) => void;
  onDelete?: (serviceId: string) => void;
}

export default function EditGeneralServiceModal({
  isOpen,
  onClose,
  service,
  onSuccess,
  onDelete,
}: EditGeneralServiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
  });

  useEffect(() => {
    if (service) {
      reset({
        client_name: service.client_name,
        client_phone: service.client_phone || '',
        client_national_id: service.client_national_id || '',
        category: service.category,
        title: service.title,
        fee_amount: service.fee_amount,
        cost_amount: service.cost_amount,
        office_profit: service.office_profit,
        status: service.status,
        notes: service.notes || '',
      });
    }
  }, [service, reset]);

  if (!isOpen || !service) return null;

  const watchFee = watch('fee_amount') || 0;
  const watchCost = watch('cost_amount') || 0;

  const handleFeeCostChange = (feeVal?: number, costVal?: number) => {
    const f = feeVal !== undefined ? feeVal : watchFee;
    const c = costVal !== undefined ? costVal : watchCost;
    setValue('office_profit', Math.max(0, f - c));
  };

  const onSubmit = async (data: ServiceInput) => {
    setIsSubmitting(true);
    try {
      const fee = Number(data.fee_amount || 0);
      const cost = Number(data.cost_amount || 0);
      const profit = data.office_profit !== undefined ? Number(data.office_profit) : fee - cost;

      const updated: GeneralService = {
        ...service,
        client_name: data.client_name,
        client_phone: data.client_phone || undefined,
        client_national_id: data.client_national_id || undefined,
        category: data.category as ServiceCategory,
        title: data.title,
        fee_amount: fee,
        cost_amount: cost,
        office_profit: profit,
        status: data.status as ServiceStatus,
        notes: data.notes || undefined,
      };

      onSuccess(updated);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (onDelete && confirm(`هل أنت أعدت التأكيد على حذف معاملة ${service.service_number} (${service.client_name})؟`)) {
      setIsDeleting(true);
      try {
        await onDelete(service.id);
        onClose();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل معاملة {service.service_number}</h3>
              <p className="text-xs text-slate-400">تعديل بيانات العميل، التكلفة، أو تغيير حالة المعاملة</p>
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم العميل *</label>
              <input
                type="text"
                {...register('client_name')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
              {errors.client_name && (
                <p className="text-[11px] text-red-400 mt-1">{errors.client_name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم الجوال</label>
              <input
                type="text"
                {...register('client_phone')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تصنيف الخدمة *</label>
              <select
                {...register('category')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="EJAR">منصة إيجار (توثيق وصياغة عقود)</option>
                <option value="BALADY">منصة بلدي (تراخيص ومعاينات)</option>
                <option value="QIWA">منصة قوى (تأهيل ورخص عمالة)</option>
                <option value="DEED_SURVEY">صكوك ورفع مساحي وإحكام</option>
                <option value="GOV_TRANSACTION">معاملة حكومية / كتابة عدل</option>
                <option value="OTHER">خدمات عامة أخرى</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم الخدمة *</label>
              <input
                type="text"
                {...register('title')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
              {errors.title && (
                <p className="text-[11px] text-red-400 mt-1">{errors.title.message}</p>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">المبلغ المحصل (ر.س) *</label>
                <input
                  type="number"
                  step="any"
                  {...register('fee_amount', {
                    valueAsNumber: true,
                    onChange: (e) => handleFeeCostChange(Number(e.target.value), watchCost),
                  })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">التكلفة (ر.س)</label>
                <input
                  type="number"
                  step="any"
                  {...register('cost_amount', {
                    valueAsNumber: true,
                    onChange: (e) => handleFeeCostChange(watchFee, Number(e.target.value)),
                  })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">ربح المكتب (ر.س) *</label>
                <input
                  type="number"
                  step="any"
                  {...register('office_profit', { valueAsNumber: true })}
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-amber-200 font-bold focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">حالة الخدمة والمعاملة *</label>
              <select
                {...register('status')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="Completed">مكتملة (تم الإنجاز والتحصيل)</option>
                <option value="In_Progress">جاري التنفيذ المتابعة</option>
                <option value="Pending">قيد الانتظار</option>
                <option value="Cancelled">ملغاة</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">ملاحظات</label>
              <input
                type="text"
                {...register('notes')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>حذف المعاملة</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
