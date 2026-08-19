'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Building2, CheckCircle2 } from 'lucide-react';
import { Property, Lessor, Representative, PropertyType } from '@/lib/types';

const propertySchema = z.object({
  title: z.string().min(3, 'اسم العقار يجب أن يتكون من 3 حروف على الأقل'),
  property_type: z.enum(['Residential', 'Commercial', 'Land']),
  address: z.string().min(3, 'العنوان مطلوب'),
  city: z.string().min(2, 'المدينة مطلوبة'),
  units_count: z.number().min(1, 'عدد الوحدات يجب أن يكون 1 على الأقل'),
  lessor_id: z.string().min(1, 'يرجى اختيار المالك'),
  current_representative_id: z.string().optional(),
});

type PropertyInput = z.infer<typeof propertySchema>;

interface EditPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
  lessors: Lessor[];
  representatives: Representative[];
  onSuccess: (updatedProperty: Property) => void;
}

export default function EditPropertyModal({
  isOpen,
  onClose,
  property,
  lessors,
  representatives,
  onSuccess,
}: EditPropertyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema),
  });

  useEffect(() => {
    if (property) {
      reset({
        title: property.title,
        property_type: property.property_type,
        address: property.address,
        city: property.city,
        units_count: property.units_count,
        lessor_id: property.lessor_id,
        current_representative_id: property.current_representative_id || '',
      });
    }
  }, [property, reset]);

  if (!isOpen || !property) return null;

  const onSubmit = async (data: PropertyInput) => {
    setIsSubmitting(true);
    try {
      const lessor = lessors.find((l) => l.id === data.lessor_id);
      const rep = representatives.find((r) => r.id === data.current_representative_id);

      const updated: Property = {
        ...property,
        title: data.title,
        property_type: data.property_type as PropertyType,
        address: data.address,
        city: data.city,
        units_count: Number(data.units_count),
        lessor_id: data.lessor_id,
        lessor,
        current_representative_id: data.current_representative_id || undefined,
        current_representative: rep,
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
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل بيانات العقار</h3>
              <p className="text-xs text-slate-400">تحديث العنوان، النوع، المالك والوكيل</p>
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
              <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم العقار *</label>
              <input
                type="text"
                {...register('title')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              {errors.title && (
                <p className="text-[11px] text-red-400 mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">نوع العقار *</label>
              <select
                {...register('property_type')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              >
                <option value="Residential">سكني (Residential)</option>
                <option value="Commercial">تجاري (Commercial)</option>
                <option value="Land">أرض (Land)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">عنوان العقار *</label>
              <input
                type="text"
                {...register('address')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
              {errors.address && (
                <p className="text-[11px] text-red-400 mt-1">{errors.address.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">المدينة *</label>
              <input
                type="text"
                {...register('city')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">عدد الوحدات *</label>
              <input
                type="number"
                min="1"
                {...register('units_count', { valueAsNumber: true })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">المالك / المؤجر *</label>
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
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">الوكيل / الممثل الحالي</label>
            <select
              {...register('current_representative_id')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="">-- بدون وكيل حالياً --</option>
              {representatives.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.national_id})
                </option>
              ))}
            </select>
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
