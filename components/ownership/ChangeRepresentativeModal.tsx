'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, UserCheck, ShieldAlert, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { changeRepresentativeSchema, ChangeRepresentativeInput } from '@/lib/validations';
import { Property, Representative, OwnershipAuditLog } from '@/lib/types';
import { executeChangeRepresentative } from '@/lib/services/stateTransfers';

interface ChangeRepresentativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  representatives: Representative[];
  auditLogs: OwnershipAuditLog[];
  onSuccess: (updatedProperties: Property[], updatedAuditLogs: OwnershipAuditLog[]) => void;
}

export default function ChangeRepresentativeModal({
  isOpen,
  onClose,
  properties,
  representatives,
  auditLogs,
  onSuccess,
}: ChangeRepresentativeModalProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangeRepresentativeInput>({
    resolver: zodResolver(changeRepresentativeSchema),
  });

  if (!isOpen) return null;

  const currentProperty = properties.find((p) => p.id === selectedPropertyId);
  const currentRep = currentProperty?.current_representative;

  const onSubmit = async (data: ChangeRepresentativeInput) => {
    setIsSubmitting(true);
    try {
      const result = await executeChangeRepresentative({
        properties,
        auditLogs,
        representatives,
        lessors: [],
        propertyId: data.property_id,
        newRepresentativeId: data.new_representative_id,
        notes: data.notes,
      });

      onSuccess(result.updatedProperties, result.updatedAuditLogs);
      reset();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'حدث خطأ أثناء تغيير الوكيل');
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
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">إجراء: تغيير مُمثل / وكيل العقار</h3>
              <p className="text-xs text-slate-400">نقل صلاحية التمثيل وتوثيق التغيير في سجل التدقيق</p>
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
            <label className="block text-xs font-medium text-slate-300 mb-1.5">1. اختر العقار المستهدف *</label>
            <select
              {...register('property_id')}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="">-- اختر العقار --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} - {p.city} (المؤجر: {p.lessor?.name || 'غير معروف'})
                </option>
              ))}
            </select>
            {errors.property_id && (
              <p className="text-[11px] text-red-400 mt-1">{errors.property_id.message}</p>
            )}
          </div>

          {/* Current Status Box */}
          {currentProperty && (
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 text-xs space-y-1.5">
              <div className="text-slate-400 font-semibold flex items-center justify-between">
                <span>الممثل / الوكيل الحالي للعقار:</span>
                <span className="text-amber-400 font-bold">{currentRep ? currentRep.name : 'لا يوجد ممثل مخصص'}</span>
              </div>
              {currentRep && (
                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                  <span>الهوية: {currentRep.national_id}</span>
                  <span>رقم الوكالة: {currentRep.e_poa_number || 'غير مسجل'}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select New Representative */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">2. اختر الممثل / الوكيل الجديد *</label>
            <select
              {...register('new_representative_id')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="">-- اختر الوكيل الجديد --</option>
              {representatives
                .filter((r) => r.id !== currentRep?.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} - هوية: {r.national_id} ({r.e_poa_number || 'وكالة إلكترونية'})
                  </option>
                ))}
            </select>
            {errors.new_representative_id && (
              <p className="text-[11px] text-red-400 mt-1">{errors.new_representative_id.message}</p>
            )}
          </div>

          {/* Step 3: Notes / Reason */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">سبب/ملاحظات التغيير (تُسجل في الأرشيف)</label>
            <textarea
              rows={3}
              placeholder="مثال: بناءً على خطاط الوكالة الجديد رقم #POA-8822"
              {...register('notes')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Warning Banner */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>سيتم تحديث سجلات النظام فوراً وتدوين العملية في سجل التدقيق التاريخي (Audit Trail).</span>
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
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الاعتماد...' : 'اعتماد التغيير والتدقيق'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
