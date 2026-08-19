'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerOrderSchema, CustomerOrderInput } from '../../lib/validations';
import { useData } from '../../context/DataContext';
import { CustomerOrder } from '../../lib/types';
import {
  X,
  Save,
  ClipboardList,
  Phone,
  User,
  Building2,
  MapPin,
  Coins,
  CheckCircle,
  FileText,
  Home,
  Briefcase,
  Trash2,
} from 'lucide-react';

interface EditCustomerOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CustomerOrder | null;
}

export default function EditCustomerOrderModal({ isOpen, onClose, order }: EditCustomerOrderModalProps) {
  const { updateCustomerOrder, deleteCustomerOrder } = useData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CustomerOrderInput>({
    resolver: zodResolver(customerOrderSchema),
  });

  const selectedCategory = watch('category');

  useEffect(() => {
    if (order) {
      reset({
        client_name: order.client_name,
        client_phone: order.client_phone,
        category: order.category,
        building_type: order.building_type,
        desired_area: order.desired_area,
        budget_min: order.budget_min,
        budget_max: order.budget_max,
        status: order.status,
        notes: order.notes || '',
      });
    }
  }, [order, reset]);

  if (!isOpen || !order) return null;

  const onSubmit = async (data: CustomerOrderInput) => {
    setIsSubmitting(true);
    try {
      const updatedOrder: CustomerOrder = {
        ...order,
        client_name: data.client_name,
        client_phone: data.client_phone,
        category: data.category,
        building_type: data.building_type,
        desired_area: data.desired_area,
        budget_min: data.budget_min,
        budget_max: data.budget_max,
        status: data.status,
        notes: data.notes,
      };

      await updateCustomerOrder(updatedOrder);
      onClose();
    } catch (err) {
      console.error('Error updating customer order:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('هل أنت تأكد من رغبتك في حذف هذا الطلب؟')) {
      await deleteCustomerOrder(order.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 p-6 md:p-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">تعديل طلب العميل ({order.order_number})</h2>
              <p className="text-xs text-slate-400">تحديث حالة الطلب أو المتطلبات المحددة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 1. Category Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">تصنيف الطلب (سكني أم تجاري)*</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setValue('category', 'RESIDENTIAL')}
                className={`p-4 rounded-xl border flex items-center justify-center gap-3 font-bold text-sm transition ${
                  selectedCategory === 'RESIDENTIAL'
                    ? 'bg-sky-600/20 border-sky-500 text-sky-400 shadow-md shadow-sky-600/10'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Home className="w-5 h-5" />
                <span>عقار سكني</span>
              </button>
              <button
                type="button"
                onClick={() => setValue('category', 'COMMERCIAL')}
                className={`p-4 rounded-xl border flex items-center justify-center gap-3 font-bold text-sm transition ${
                  selectedCategory === 'COMMERCIAL'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-md shadow-purple-600/10'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span>عقار تجاري</span>
              </button>
            </div>
            {errors.category && <p className="text-xs text-rose-400 mt-1">{errors.category.message}</p>}
          </div>

          {/* 2. Client Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-sky-400" />
                اسم العميل الكامل*
              </label>
              <input
                type="text"
                {...register('client_name')}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
              />
              {errors.client_name && <p className="text-xs text-rose-400">{errors.client_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-sky-400" />
                رقم الجوال*
              </label>
              <input
                type="text"
                {...register('client_phone')}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition dir-ltr text-right"
              />
              {errors.client_phone && <p className="text-xs text-rose-400">{errors.client_phone.message}</p>}
            </div>
          </div>

          {/* 3. Building Type & Desired Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                نوع العقار المطلوب*
              </label>
              <input
                type="text"
                {...register('building_type')}
                placeholder="مثال: فيلا، شقة، معرض، مكتب..."
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 transition"
              />
              {errors.building_type && <p className="text-xs text-rose-400">{errors.building_type.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                المنطقة / الحي والمساحة المطلوبة*
              </label>
              <input
                type="text"
                {...register('desired_area')}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
              />
              {errors.desired_area && <p className="text-xs text-rose-400">{errors.desired_area.message}</p>}
            </div>
          </div>

          {/* 4. Budget Range & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                الميزانية الدنيا (ر.س)
              </label>
              <input
                type="number"
                {...register('budget_min')}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                الميزانية العليا (ر.س)
              </label>
              <input
                type="number"
                {...register('budget_max')}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
                حالة الطلب*
              </label>
              <select
                {...register('status')}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 transition font-medium"
              >
                <option value="New">جديد (New)</option>
                <option value="Searching">قيد البحث (Searching)</option>
                <option value="Fulfilled">تم توفير العقار (Fulfilled)</option>
                <option value="Cancelled">ملغى (Cancelled)</option>
              </select>
            </div>
          </div>

          {/* 5. Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              ملاحظات وتفاصيل إضافية للعميل
            </label>
            <textarea
              rows={3}
              {...register('notes')}
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف الطلب</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الحفظ...' : 'تحديث الطلب'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
