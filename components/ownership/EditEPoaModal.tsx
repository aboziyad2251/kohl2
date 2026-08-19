'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { EPoa, Lessor, Representative, EPoaStatus } from '@/lib/types';

const ePoaSchema = z.object({
  poa_number: z.string().min(3, 'رقم الوكالة مطلوب'),
  grantor_id: z.string().min(1, 'يرجى اختيار الموكل (المؤجر)'),
  attorney_id: z.string().min(1, 'يرجى اختيار الوكيل (الممثل)'),
  issue_date: z.string().min(1, 'تاريخ الإصدار مطلوب'),
  expiry_date: z.string().min(1, 'تاريخ الانتهاء مطلوب'),
  scope_details: z.string().optional(),
  status: z.enum(['Active', 'Expired', 'Revoked']),
});

type EPoaInput = z.infer<typeof ePoaSchema>;

interface EditEPoaModalProps {
  isOpen: boolean;
  onClose: () => void;
  ePoa: EPoa | null;
  lessors: Lessor[];
  representatives: Representative[];
  onSuccess: (updatedEPoa: EPoa) => void;
}

export default function EditEPoaModal({
  isOpen,
  onClose,
  ePoa,
  lessors,
  representatives,
  onSuccess,
}: EditEPoaModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EPoaInput>({
    resolver: zodResolver(ePoaSchema),
  });

  useEffect(() => {
    if (ePoa) {
      reset({
        poa_number: ePoa.poa_number,
        grantor_id: ePoa.grantor_id,
        attorney_id: ePoa.attorney_id,
        issue_date: ePoa.issue_date,
        expiry_date: ePoa.expiry_date,
        scope_details: ePoa.scope_details || '',
        status: ePoa.status,
      });
    }
  }, [ePoa, reset]);

  if (!isOpen || !ePoa) return null;

  const onSubmit = async (data: EPoaInput) => {
    setIsSubmitting(true);
    try {
      const grantor = lessors.find((l) => l.id === data.grantor_id);
      const attorney = representatives.find((r) => r.id === data.attorney_id);

      const updated: EPoa = {
        ...ePoa,
        poa_number: data.poa_number,
        grantor_id: data.grantor_id,
        attorney_id: data.attorney_id,
        grantor,
        attorney,
        issue_date: data.issue_date,
        expiry_date: data.expiry_date,
        scope_details: data.scope_details,
        status: data.status as EPoaStatus,
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل الوكالة الإلكترونية E-POA</h3>
              <p className="text-xs text-slate-400">تحديث تفاصيل الوكالة والصلاحيات</p>
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم الوكالة الإلكترونية *</label>
              <input
                type="text"
                {...register('poa_number')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
              {errors.poa_number && (
                <p className="text-[11px] text-red-400 mt-1">{errors.poa_number.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">حالة الوكالة *</label>
              <select
                {...register('status')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="Active">نشطة (Active)</option>
                <option value="Expired">منتهية (Expired)</option>
                <option value="Revoked">ملغاة (Revoked)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">الموكل (المؤجر) *</label>
              <select
                {...register('grantor_id')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">-- اختر الموكل --</option>
                {lessors.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.national_id_or_cr})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">الوكيل الممثل *</label>
              <select
                {...register('attorney_id')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">-- اختر الوكيل --</option>
                {representatives.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.national_id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ الإصدار *</label>
              <input
                type="date"
                {...register('issue_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ الانتهاء *</label>
              <input
                type="date"
                {...register('expiry_date')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">تفاصيل وصلاحيات الوكالة</label>
            <textarea
              rows={2}
              {...register('scope_details')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
            ></textarea>
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
              className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
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
