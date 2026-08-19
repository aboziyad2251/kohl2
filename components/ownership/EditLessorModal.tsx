'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, UserCheck, CheckCircle2 } from 'lucide-react';
import { Lessor } from '@/lib/types';

const lessorSchema = z.object({
  name: z.string().min(3, 'اسم المؤجر يجب أن يتكون من 3 حروف على الأقل'),
  national_id_or_cr: z.string().min(8, 'الهوية أو السجل يجب أن يتكون من 8 أرقام على الأقل'),
  phone: z.string().min(9, 'رقم الجوال يجب أن يتكون من 9 أرقام على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
});

type LessorInput = z.infer<typeof lessorSchema>;

interface EditLessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessor: Lessor | null;
  onSuccess: (updatedLessor: Lessor) => void;
}

export default function EditLessorModal({
  isOpen,
  onClose,
  lessor,
  onSuccess,
}: EditLessorModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LessorInput>({
    resolver: zodResolver(lessorSchema),
  });

  useEffect(() => {
    if (lessor) {
      reset({
        name: lessor.name,
        national_id_or_cr: lessor.national_id_or_cr,
        phone: lessor.phone,
        email: lessor.email || '',
      });
    }
  }, [lessor, reset]);

  if (!isOpen || !lessor) return null;

  const onSubmit = async (data: LessorInput) => {
    setIsSubmitting(true);
    try {
      const updated: Lessor = {
        ...lessor,
        name: data.name,
        national_id_or_cr: data.national_id_or_cr,
        phone: data.phone,
        email: data.email || undefined,
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
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل بيانات المالك / المؤجر</h3>
              <p className="text-xs text-slate-400">تحديث الاسم والهوية والجوال</p>
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
            <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم المؤجر / المالك الكامل *</label>
            <input
              type="text"
              {...register('name')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
            {errors.name && (
              <p className="text-[11px] text-red-400 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">الهوية الوطنية / السجل التجاري *</label>
            <input
              type="text"
              {...register('national_id_or_cr')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
            {errors.national_id_or_cr && (
              <p className="text-[11px] text-red-400 mt-1">{errors.national_id_or_cr.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم الجوال *</label>
              <input
                type="text"
                {...register('phone')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
              {errors.phone && (
                <p className="text-[11px] text-red-400 mt-1">{errors.phone.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                {...register('email')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
              {errors.email && (
                <p className="text-[11px] text-red-400 mt-1">{errors.email.message}</p>
              )}
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
