'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, UserCheck, Plus, CheckCircle2 } from 'lucide-react';
import { Tenant } from '@/lib/types';

const tenantSchema = z.object({
  name: z.string().min(3, 'اسم المستأجر يجب أن يتكون من 3 حروف على الأقل'),
  national_id: z.string().min(8, 'رقم الهوية / السجل يجب أن يتكون من 8 أرقام على الأقل'),
  phone: z.string().min(9, 'رقم الجوال يجب أن يتكون من 9 أرقام على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  type: z.enum(['Individual', 'Company']),
});

type TenantInput = z.infer<typeof tenantSchema>;

interface AddTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTenant: Tenant) => void;
}

export default function AddTenantModal({
  isOpen,
  onClose,
  onSuccess,
}: AddTenantModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TenantInput>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      type: 'Individual',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: TenantInput) => {
    setIsSubmitting(true);
    try {
      const newTenant: Tenant = {
        id: `tnt-${Date.now()}`,
        name: data.name,
        national_id: data.national_id,
        phone: data.phone,
        email: data.email || undefined,
        type: data.type,
        created_at: new Date().toISOString(),
      };

      onSuccess(newTenant);
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">إضافة مستأجر جديد للسجل</h3>
              <p className="text-xs text-slate-400">تسجيل بيانات المستأجر (أفراد أو شركات) في القاعدة</p>
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
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">نوع المستأجر *</label>
            <select
              {...register('type')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="Individual">فرد (أفراد)</option>
              <option value="Company">منشأة / شركة / مؤسسة</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم المستأجر الكامل *</label>
            <input
              type="text"
              placeholder="مثال: فهد عبد الله الزهراني"
              {...register('name')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
            {errors.name && (
              <p className="text-[11px] text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">الهوية الوطنية / السجل التجاري *</label>
            <input
              type="text"
              placeholder="مثال: 1099887766 أو 7001928374"
              {...register('national_id')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
            {errors.national_id && (
              <p className="text-[11px] text-red-400 mt-1">{errors.national_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم الجوال *</label>
              <input
                type="text"
                placeholder="0512345678"
                {...register('phone')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
              {errors.phone && (
                <p className="text-[11px] text-red-400 mt-1">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">البريد الإلكتروني (اختياري)</label>
              <input
                type="email"
                placeholder="tenant@example.com"
                {...register('email')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
              />
              {errors.email && (
                <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Footer Actions */}
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
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'إضافة المستأجر'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
