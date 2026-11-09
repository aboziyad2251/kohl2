'use client';
import {useDraftState,useDraftControls} from '@/lib/drafts/hooks';

import {propertyKinds,propertyUses} from '@/lib/property-classification';
import React, { useState } from 'react';
import ImportPropertyModal from './ImportPropertyModal';
import {useDraftForm} from '@/lib/drafts/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, FileText, Building2, User, Plus, CheckCircle2 } from 'lucide-react';
import { ownershipDocumentPropertySchema, OwnershipDocumentPropertyInput } from '@/lib/validations';
import { Lessor, Representative, Property, OwnershipDocument } from '@/lib/types';
import { generateEntityId } from '@/lib/services/dbService';

interface AddDocumentPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessors: Lessor[];
  representatives: Representative[];
  onSuccess: (newProp: Property, newDoc: OwnershipDocument) => void | Promise<void>;
}

export default function AddDocumentPropertyModal({
  isOpen,
  onClose,
  lessors,
  representatives,
  onSuccess,
}: AddDocumentPropertyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importing,setImporting]=useDraftState('AddDocumentPropertyModal:importing', false);
  const [saveError,setSaveError] = useState('');

  const {
    register,
    handleSubmit,
    clearDraft,
    reset,
    formState: { errors },
  } = useDraftForm<OwnershipDocumentPropertyInput>('AddDocumentPropertyModal', {
    resolver: zodResolver(ownershipDocumentPropertySchema),
    defaultValues: {
      units_count: 1,
      property_type: 'Residential',
    },
  }, isOpen);

  if (!isOpen) return null;

  if(importing)return <ImportPropertyModal lessors={lessors} onClose={()=>setImporting(false)} onSaved={()=>{setImporting(false);onClose();window.location.reload();}} />;

  const onSubmit = async (data: OwnershipDocumentPropertyInput) => {
    setIsSubmitting(true);
    setSaveError('');
    try {
      const lessor = lessors.find((l) => l.id === data.lessor_id);
      const rep = representatives.find((r) => r.id === data.current_representative_id);

      const newDoc: OwnershipDocument = {
        id: generateEntityId(),
        document_number: data.document_number,
        issue_date: data.issue_date,
        lessor_id: data.lessor_id,
        lessor,
        file_url: data.file_url || '/docs/sample_deed.pdf',
        created_at: new Date().toISOString(),
      };

      const newProp: Property = {
        id: generateEntityId(),
        title: data.property_title,
        property_type: data.property_type,
        property_kind:data.property_kind,property_use:data.property_type as 'Residential'|'Commercial',
        address: data.address,
        city: data.city,
        units_count: Number(data.units_count),
        latitude: data.latitude,
        map_purposes: data.map_purposes,
        map_visible: true,
        longitude: data.longitude,
        ownership_document_id: newDoc.id,
        ownership_document: newDoc,
        lessor_id: data.lessor_id,
        lessor,
        current_representative_id: data.current_representative_id,
        current_representative: rep,
        created_at: new Date().toISOString(),
      };

      await onSuccess(newProp, newDoc);
      reset();
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'تعذر حفظ العقار');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">تسجيل صك ملكية وعقار جديد</h3>
              <p className="text-xs text-slate-400">إدخال صك الملكية وبيانات العقار المرتبط به في إجراء واحد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4"><button type="button" onClick={()=>setImporting(true)} className="portal-button">إضافة عقار أو أكثر من Excel</button><p className="text-xs text-slate-400 mt-2">قراءة الشقق من A5 إلى آخر رقم، ثم إضافة الصك.</p></div>
        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6"><label className="block text-sm font-bold">نوع العقار<select className="portal-input" {...register('property_kind')}><option value="">حدد نوع العقار</option>{propertyKinds.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{errors.property_kind&&<span className="text-red-400">حدد نوع العقار</span>}</label>
          {saveError && <p role="alert" className="text-red-400">{saveError}</p>}
          <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3"><legend className="font-bold mb-2">دبوس موقع العقار (مطلوب)</legend><label className="text-xs">خط العرض Latitude *<input type="number" step="any" min="-90" max="90" required {...register('latitude', { valueAsNumber: true })} className="portal-input" dir="ltr" />{errors.latitude && <span className="text-red-400">أدخل خط عرض بين -90 و90</span>}</label><label className="text-xs">خط الطول Longitude *<input type="number" step="any" min="-180" max="180" required {...register('longitude', { valueAsNumber: true })} className="portal-input" dir="ltr" />{errors.longitude && <span className="text-red-400">أدخل خط طول بين -180 و180</span>}</label><p className="text-xs text-slate-400 sm:col-span-2">انسخ إحداثيات دبوس العقار من Google Maps. يمكنك إضافة الصور والفيديو بعد حفظ العقار من زر ملف العقار.</p></fieldset>
          <fieldset><legend className="font-bold mb-2">التصنيف في خريطة كحل العقارية</legend><div className="flex flex-wrap gap-4">{([['MANAGEMENT','تحت الإدارة'],['RENT','للإيجار'],['SALE','للبيع']] as const).map(([value,label])=><label key={value} className="flex gap-2 text-sm"><input type="checkbox" value={value} {...register('map_purposes')}/>{label}</label>)}</div></fieldset>
          {/* Section 1: Ownership Document */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm border-b border-slate-800 pb-2">
              <FileText className="w-4 h-4" />
              <span>أولاً: بيانات صك الملكية (المستند الرسمي)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">رقم صك الملكية *</label>
                <input
                  type="text"
                  placeholder="مثال: 92831-2024-DEED"
                  {...register('document_number')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
                {errors.document_number && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.document_number.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ إصدار الصك *</label>
                <input
                  type="date"
                  {...register('issue_date')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
                {errors.issue_date && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.issue_date.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">المالك / المؤجر المسجل بالصك *</label>
              <select
                {...register('lessor_id')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="">-- اختر المالك --</option>
                {lessors.map((lessor) => (
                  <option key={lessor.id} value={lessor.id}>
                    {lessor.name} ({lessor.national_id_or_cr})
                  </option>
                ))}
              </select>
              {errors.lessor_id && (
                <p className="text-[11px] text-red-400 mt-1">{errors.lessor_id.message}</p>
              )}
            </div>
          </div>

          {/* Section 2: Property Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm border-b border-slate-800 pb-2">
              <Building2 className="w-4 h-4" />
              <span>ثانياً: تفاصيل وبيانات العقار</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم / عنوان العقار *</label>
                <input
                  type="text"
                  placeholder="مثال: برج الياسمين السكني"
                  {...register('property_title')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
                {errors.property_title && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.property_title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">استخدام العقار *</label>
                <select
                  {...register('property_type')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="Residential">سكني (Residential)</option>
                  <option value="Commercial">تجاري (Commercial)</option>
                  
                </select>
                {errors.property_type && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.property_type.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">عنوان العقار *</label>
                <input
                  type="text"
                  placeholder="اسم الشارع، رقم المبنى، الحي"
                  {...register('address')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
                {errors.address && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.address.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">المدينة *</label>
                <input
                  type="text"
                  placeholder="الرياض / جدة..."
                  {...register('city')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                />
                {errors.city && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.city.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">عدد الوحدات بالعقار *</label>
                <input
                  type="number"
                  min="1"
                  {...register('units_count', { valueAsNumber: true })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                />
                {errors.units_count && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.units_count.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">الوكيل / الممثل الحالي (اختياري)</label>
                <select
                  {...register('current_representative_id')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="">-- بدون ممثل حالياً --</option>
                  {representatives.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name} ({rep.national_id})
                    </option>
                  ))}
                </select>
              </div>
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
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ الصك والعقار'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

