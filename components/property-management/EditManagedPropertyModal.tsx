'use client';

import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { ManagedPropertyContract, ManagementFeeType, ManagementStatus } from '../../lib/types';
import { X, Building, User, Phone, CheckCircle, Trash2 } from 'lucide-react';

interface EditManagedPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: ManagedPropertyContract | null;
}

export default function EditManagedPropertyModal({
  isOpen,
  onClose,
  contract,
}: EditManagedPropertyModalProps) {
  const { updateManagedProperty, deleteManagedProperty } = useData();

  const [propertyName, setPropertyName] = useState('');
  const [lessorName, setLessorName] = useState('');
  const [lessorPhone, setLessorPhone] = useState('');
  const [propertyType, setPropertyType] = useState<'Residential' | 'Commercial' | 'Mixed'>('Residential');
  const [totalUnits, setTotalUnits] = useState(10);
  const [occupiedUnits, setOccupiedUnits] = useState(8);
  const [feeType, setFeeType] = useState<ManagementFeeType>('PERCENTAGE');
  const [feeValue, setFeeValue] = useState(5.0);
  const [annualRevenue, setAnnualRevenue] = useState(360000);
  const [collectedRevenue, setCollectedRevenue] = useState(180000);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<ManagementStatus>('Active');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (contract) {
      setPropertyName(contract.property_name);
      setLessorName(contract.lessor_name);
      setLessorPhone(contract.lessor_phone);
      setPropertyType(contract.property_type);
      setTotalUnits(contract.total_units);
      setOccupiedUnits(contract.occupied_units);
      setFeeType(contract.fee_type);
      setFeeValue(contract.fee_value);
      setAnnualRevenue(contract.annual_expected_revenue);
      setCollectedRevenue(contract.collected_revenue);
      setStartDate(contract.start_date);
      setEndDate(contract.end_date);
      setStatus(contract.status);
      setNotes(contract.notes || '');
    }
  }, [contract]);

  if (!isOpen || !contract) return null;

  const calculatedVacant = Math.max(0, totalUnits - occupiedUnits);
  const calculatedFeeAmount =
    feeType === 'PERCENTAGE' ? (collectedRevenue * feeValue) / 100 : feeValue;
  const calculatedNetToOwner = Math.max(0, collectedRevenue - calculatedFeeAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName.trim() || !lessorName.trim() || !lessorPhone.trim()) {
      alert('يرجى ملء كافة الحقول الأساسية');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated: ManagedPropertyContract = {
        ...contract,
        property_name: propertyName.trim(),
        lessor_name: lessorName.trim(),
        lessor_phone: lessorPhone.trim(),
        property_type: propertyType,
        total_units: Number(totalUnits),
        occupied_units: Number(occupiedUnits),
        vacant_units: calculatedVacant,
        fee_type: feeType,
        fee_value: Number(feeValue),
        annual_expected_revenue: Number(annualRevenue),
        collected_revenue: Number(collectedRevenue),
        transferred_to_owner: calculatedNetToOwner,
        start_date: startDate,
        end_date: endDate,
        status: status,
        notes: notes.trim(),
      };

      await updateManagedProperty(updated);
      onClose();
    } catch (err) {
      console.error('Error updating managed property:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`هل أنت أصل ومتحقق من حذف عقد إدارة أملاك (${contract.property_name})؟`)) {
      await deleteManagedProperty(contract.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">تعديل عقد إدارة الأملاك ({contract.contract_number})</h3>
              <p className="text-xs text-slate-400">تحديث بيانات العقار وأتعاب الإدارة والتحصيل السنوي</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Property Name & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">اسم العقار / المجمع *</label>
              <input
                type="text"
                required
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">حالة العقد *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
              >
                <option value="Active">نشط (Active)</option>
                <option value="Under_Renewal">قيد التجديد (Under Renewal)</option>
                <option value="Expired">منتهي (Expired)</option>
                <option value="Suspended">موقوف (Suspended)</option>
              </select>
            </div>
          </div>

          {/* Owner Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">اسم المالك / المؤجر *</label>
              <input
                type="text"
                required
                value={lessorName}
                onChange={(e) => setLessorName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">رقم جوال المالك *</label>
              <input
                type="text"
                required
                value={lessorPhone}
                onChange={(e) => setLessorPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 dir-ltr text-right"
              />
            </div>
          </div>

          {/* Units Count */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-4 text-center">
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">إجمالي الوحدات</label>
              <input
                type="number"
                min="1"
                value={totalUnits}
                onChange={(e) => setTotalUnits(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center text-xs font-bold text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">الوحدات المؤجرة</label>
              <input
                type="number"
                min="0"
                max={totalUnits}
                value={occupiedUnits}
                onChange={(e) => setOccupiedUnits(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 text-center text-xs font-bold text-emerald-400"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">الوحدات الشاغرة</label>
              <div className="py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-amber-400">
                {calculatedVacant}
              </div>
            </div>
          </div>

          {/* Revenue & Fees */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">طريقة وحسبة الأتعاب</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="PERCENTAGE">نسبة %</option>
                  <option value="FIXED_ANNUAL">مبلغ مقطوع</option>
                </select>
                <input
                  type="number"
                  step="0.1"
                  value={feeValue}
                  onChange={(e) => setFeeValue(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">التحصيل المحقق فعلياً (ر.س)</label>
              <input
                type="number"
                value={collectedRevenue}
                onChange={(e) => setCollectedRevenue(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">ملاحظات العقد</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>حذف العقد</span>
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
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الحفظ...' : 'تحديث البيانات'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
