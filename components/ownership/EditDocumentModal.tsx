'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, FileText, CheckCircle2 } from 'lucide-react';
import { OwnershipDocument, Lessor } from '@/lib/types';

const docSchema = z.object({
  document_number: z.string().min(3, 'رقم صك الملكية مطلوب'),
  issue_date: z.string().min(1, 'تاريخ الإصدار مطلوب'),
  lessor_id: z.string().min(1, 'يرجى اختيار المالك المسجل بالصك'),
  file_url: z.string().optional(),
});

type DocInput = z.infer<typeof docSchema>;

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentItem: OwnershipDocument | null;
  lessors: Lessor[];
  onSuccess: (updatedDoc: OwnershipDocument) => void;
}

export default function EditDocumentModal({
  isOpen,
  onClose,
  documentItem,
  lessors,
  onSuccess,
}: EditDocumentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DocInput>({
    resolver: zodResolver(docSchema),
  });

  useEffect(() => {
    if (documentItem) {
      reset({
        document_number: documentItem.document_number,
        issue_date: documentItem.issue_date,
        lessor_id: documentItem.lessor_id,
        file_url: documentItem.file_url || '',
      });
    }
  }, [documentItem, reset]);

  if (!isOpen || !documentItem) return null;

  const onSubmit = async (data: DocInput) => {
    setIsSubmitting(true);
    try {
      const lessor = lessors.find((l) => l.id === data.lessor_id);

      const updated: OwnershipDocument = {
        ...documentItem,
        document_number: data.document_number,
        issue_date: data.issue_date,
        lessor_id: data.lessor_id,
        lessor,
        file_url: data.file_url || documentItem.file_url,
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
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل بيانات صك الملكية</h3>
              <p className="text-xs text-slate-400">تحديث رقم الصك والتاريخ والمالك</p>
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
            <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم صك الملكية *</label>
            <input
              type="text"
              {...register('document_number')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
            {errors.document_number && (
              <p className="text-[11px] text-red-400 mt-1">{errors.document_number.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ الإصدار *</label>
            <input
              type="date"
              {...register('issue_date')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            />
            {errors.issue_date && (
              <p className="text-[11px] text-red-400 mt-1">{errors.issue_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">المالك المسجل بالصك *</label>
            <select
              {...register('lessor_id')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="">-- اختر المالك --</option>
              {lessors.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.national_id_or_cr})
                </option>
              ))}
            </select>
            {errors.lessor_id && (
              <p className="text-[11px] text-red-400 mt-1">{errors.lessor_id.message}</p>
            )}
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
