'use client';

import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { PropertyMaintenanceTask, MaintenanceStatus } from '../../lib/types';
import { X, Wrench, User, Phone, CheckCircle, Trash2 } from 'lucide-react';

interface EditMaintenanceTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: PropertyMaintenanceTask | null;
}

export default function EditMaintenanceTaskModal({
  isOpen,
  onClose,
  task,
}: EditMaintenanceTaskModalProps) {
  const { managedProperties, updateMaintenanceTask, deleteMaintenanceTask } = useData();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [unitName, setUnitName] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('');
  const [costAmount, setCostAmount] = useState(0);
  const [contractorName, setContractorName] = useState('');
  const [contractorPhone, setContractorPhone] = useState('');
  const [status, setStatus] = useState<MaintenanceStatus>('Pending');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (task) {
      setSelectedPropertyId(task.managed_property_id);
      setUnitName(task.unit_name || '');
      setMaintenanceType(task.maintenance_type);
      setCostAmount(task.cost_amount);
      setContractorName(task.contractor_name || '');
      setContractorPhone(task.contractor_phone || '');
      setStatus(task.status);
      setNotes(task.notes || '');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const selectedManagedProperty = managedProperties.find(
    (p) => p.id === selectedPropertyId
  );
  const propertyName = selectedManagedProperty?.property_name || task.property_name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const updated: PropertyMaintenanceTask = {
        ...task,
        managed_property_id: selectedPropertyId,
        property_name: propertyName,
        unit_name: unitName.trim() || undefined,
        maintenance_type: maintenanceType.trim(),
        cost_amount: Number(costAmount) || 0,
        contractor_name: contractorName.trim() || undefined,
        contractor_phone: contractorPhone.trim() || undefined,
        status: status,
        notes: notes.trim() || undefined,
      };

      await updateMaintenanceTask(updated);
      onClose();
    } catch (err) {
      console.error('Error updating maintenance task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`هل أنت محتسب ومؤكد لحذف أمر الصيانة (${task.task_number})؟`)) {
      await deleteMaintenanceTask(task.id);
      onClose();
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
              <h3 className="font-bold text-white text-base">تعديل أمر الصيانة ({task.task_number})</h3>
              <p className="text-xs text-slate-400">تحديث حالة أمر الصيانة والتكلفة وجوال الفني</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الوحدة المتأثرة</label>
              <input
                type="text"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">نوع الصيانة *</label>
              <input
                type="text"
                required
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">التكلفة (ر.س) *</label>
              <input
                type="number"
                required
                value={costAmount}
                onChange={(e) => setCostAmount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-amber-400 font-extrabold focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">حالة الطلب *</label>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">اسم الفني / المورد المنفذ</label>
              <input
                type="text"
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">جوال الفني</label>
              <input
                type="text"
                value={contractorPhone}
                onChange={(e) => setContractorPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 dir-ltr text-right"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">ملاحظات العمل</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>حذف الطلب</span>
            </button>

            <div className="flex items-center gap-3">
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
                <span>{isSubmitting ? 'جاري التحديث...' : 'تحديث الطلب'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
