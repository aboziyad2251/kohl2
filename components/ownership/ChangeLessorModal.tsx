'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, ArrowRightLeft, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import { changeLessorSchema, ChangeLessorInput } from '@/lib/validations';
import { Property, Lessor, OwnershipAuditLog } from '@/lib/types';
import { executeChangeLessor } from '@/lib/services/stateTransfers';

interface ChangeLessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  lessors: Lessor[];
  auditLogs: OwnershipAuditLog[];
  onSuccess: (updatedProperties: Property[], updatedAuditLogs: OwnershipAuditLog[]) => void;
}

export default function ChangeLessorModal({
  isOpen,
  onClose,
  properties,
  lessors,
  auditLogs,
  onSuccess,
}: ChangeLessorModalProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangeLessorInput>({
    resolver: zodResolver(changeLessorSchema),
  });

  if (!isOpen) return null;

  const currentProperty = properties.find((p) => p.id === selectedPropertyId);
  const currentLessor = currentProperty?.lessor;

  const onSubmit = async (data: ChangeLessorInput) => {
    setIsSubmitting(true);
    try {
      const result = await executeChangeLessor({
        properties,
        auditLogs,
        lessors,
        propertyId: data.property_id,
        newLessorId: data.new_lessor_id,
        newDeedNumber: data.new_ownership_document_number,
        notes: data.notes,
      });

      onSuccess(result.updatedProperties, result.updatedAuditLogs);
      reset();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'حدث خطأ أثناء نقل ملكية العقار');
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
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">إجراء: نقل ملكية عقار (تغيير المؤجر)</h3>
              <p className="text-xs text-slate-400">إحالة الملكية وتحديث الصك وتوثيق العملية رسمياً</p>
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
          {/* Step 1: Select Property */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">1. اختر العقار المُراد نقل ملكيته *</label>
            <select
              {...register('property_id')}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">-- اختر العقار --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.city}) - المالك الحالي: {p.lessor?.name || 'غير معروف'}
                </option>
              ))}
            </select>
            {errors.property_id && (
              <p className="text-[11px] text-red-400 mt-1">{errors.property_id.message}</p>
            )}
          </div>

          {/* Current Lessor Box */}
          {currentProperty && (
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs space-y-1">
              <div className="text-slate-400 font-semibold flex items-center justify-between">
                <span>المالك / المؤجر الحالي:</span>
                <span className="text-purple-300 font-bold">{currentLessor?.name}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                الهوية / السجل: {currentLessor?.national_id_or_cr}
              </div>
            </div>
          )}

          {/* Step 2: New Lessor */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">2. اختر المالك / المؤجر الجديد *</label>
            <select
              {...register('new_lessor_id')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">-- اختر المالك الجديد --</option>
              {lessors
                .filter((l) => l.id !== currentLessor?.id)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} - السجل/الهوية: {l.national_id_or_cr}
                  </option>
                ))}
            </select>
            {errors.new_lessor_id && (
              <p className="text-[11px] text-red-400 mt-1">{errors.new_lessor_id.message}</p>
            )}
          </div>

          {/* Step 3: New Deed Number */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">3. رقم صك الملكية الجديد للمالك *</label>
            <input
              type="text"
              placeholder="مثال: 99401-2026-DEED"
              {...register('new_ownership_document_number')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
            {errors.new_ownership_document_number && (
              <p className="text-[11px] text-red-400 mt-1">{errors.new_ownership_document_number.message}</p>
            )}
          </div>

          {/* Step 4: Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">ملاحظات مبايعة / أسباب النقل</label>
            <textarea
              rows={2}
              placeholder="تفاصيل عقد المبايعة العقارية أو قرار إحالة الملكية"
              {...register('notes')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Alert */}
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>سيتم أرشفة السجلات السابقة وتوليد صك جديد وتوثيق انتقال الملكية في سجّل تدقيق الملكية.</span>
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
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري نقل الملكية...' : 'تأكيد ونقل الملكية'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
