'use client';

import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { PropertyMaintenanceTask, MaintenanceStatus } from '../../lib/types';
import { X, Wrench, Building, Phone, User, DollarSign, CheckCircle } from 'lucide-react';

interface NewMaintenanceTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewMaintenanceTaskModal({ isOpen, onClose }: NewMaintenanceTaskModalProps) {
  const { managedProperties, addMaintenanceTask } = useData();

  const [selectedPropertyId, setSelectedPropertyId] = useState(
    managedProperties[0]?.id || ''
  );
  const [unitName, setUnitName] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('سباكة');
  const [costAmount, setCostAmount] = useState(350);
  const [contractorName, setContractorName] = useState('');
  const [contractorPhone, setContractorPhone] = useState('');
  const [status, setStatus] = useState<MaintenanceStatus>('Pending');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const selectedManagedProperty = managedProperties.find(
    (p) => p.id === selectedPropertyId
  );
  const propertyName = selectedManagedProperty?.property_name || 'عقار عام';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceType.trim()) {
      alert('يرجى اختيار وتحديد نوع الصيانة المطلوب');
      return;
    }

    setIsSubmitting(true);
    try {
      const taskNumber = `MNT-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newTask: PropertyMaintenanceTask = {
        id: crypto.randomUUID(),
        task_number: taskNumber,
        managed_property_id: selectedPropertyId,
        property_name: propertyName,
        unit_name: unitName.trim() || undefined,
        maintenance_type: maintenanceType.trim(),
        cost_amount: Number(costAmount) || 0,
        contractor_name: contractorName.trim() || undefined,
        contractor_phone: contractorPhone.trim() || undefined,
        status: status,
        notes: notes.trim() || undefined,
        created_at: new Date().toISOString(),
      };

      await addMaintenanceTask(newTask);
      onClose();
    } catch (err) {
      console.error('Error adding maintenance task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تسجيل امر صيانة عقاري جديد</h3>
              <p className="text-xs text-slate-400">إضافة طلب صيانة وتعيين الفني المنفذ والتكلفة المقدرة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Select Managed Property */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">العقار المستهدف *</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
            >
              {managedProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.property_name} ({p.lessor_name})
                </option>
              ))}
            </select>
          </div>

          {/* Unit Name & Maintenance Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">رقم أو اسم الوحدة المتأثرة</label>
              <input
                type="text"
                placeholder="مثال: شقة 204، معرض 01، المصعد..."
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">نوع الصيانة *</label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="سباكة وتمديدات">سباكة وتمديدات مياه</option>
                <option value="كهرباء وتمديدات">كهرباء وإضاءة</option>
                <option value="صيانة تكييف">صيانة تكييف مركزي/اسبليت</option>
                <option value="صيانة مصاعد">صيانة وفحص دوري للمصاعد</option>
                <option value="نظافة ورش حشرات">نظافة ومكافحة آفات</option>
                <option value="ترميم ودهانات">ترميم ودهانات وديكور</option>
                <option value="أخرى">نوع صيانة آخر</option>
              </select>
            </div>
          </div>

          {/* Cost & Contractor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">التكلفة الإجمالية للصيانة (ر.س) *</label>
              <input
                type="number"
                required
                min="0"
                value={costAmount}
                onChange={(e) => setCostAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-400 font-extrabold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">حالة أمر الصيانة *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
              >
                <option value="Pending">معلقة (Pending)</option>
                <option value="In_Progress">قيد التنفيذ (In Progress)</option>
                <option value="Completed">مكتملة ومسددة (Completed)</option>
                <option value="Cancelled">ملغاة (Cancelled)</option>
              </select>
            </div>
          </div>

          {/* Contractor Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">اسم الفني / المورد المنفذ</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="مثال: مؤسسة الشعلة للصيانة..."
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">جوال الفني المنفذ</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="05XXXXXXXX"
                  value={contractorPhone}
                  onChange={(e) => setContractorPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 dir-ltr text-right"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">ملاحظات العمل المطلوبة</label>
            <textarea
              rows={2}
              placeholder="اكتب وصف العطل أو الأجزاء المطلوب استبدالها..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-amber-600/30 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'تسجيل أمر الصيانة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
