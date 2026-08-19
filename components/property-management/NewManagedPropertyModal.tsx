'use client';

import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { ManagedPropertyContract, ManagementFeeType, ManagementStatus } from '../../lib/types';
import { X, Building, User, Phone, Layers, Percent, DollarSign, Calendar, FileText, CheckCircle } from 'lucide-react';

interface NewManagedPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NewManagedPropertyModal({ isOpen, onClose }: NewManagedPropertyModalProps) {
  const { addManagedProperty } = useData();

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
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const calculatedVacant = Math.max(0, totalUnits - occupiedUnits);
  
  // Calculate office fee
  const calculatedFeeAmount =
    feeType === 'PERCENTAGE' ? (collectedRevenue * feeValue) / 100 : feeValue;
  const calculatedNetToOwner = Math.max(0, collectedRevenue - calculatedFeeAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyName.trim() || !lessorName.trim() || !lessorPhone.trim()) {
      alert('يرجى ملء كافة الحقول الأساسية (اسم العقار، اسم المالك، الجوال)');
      return;
    }

    setIsSubmitting(true);
    try {
      const contractNumber = `PMC-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newContract: ManagedPropertyContract = {
        id: crypto.randomUUID(),
        contract_number: contractNumber,
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
        status: 'Active',
        notes: notes.trim(),
        created_at: new Date().toISOString(),
      };

      await addManagedProperty(newContract);
      onClose();
    } catch (err) {
      console.error('Error adding managed property:', err);
    } finally {
      setIsSubmitting(false);
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
              <h3 className="font-bold text-white text-base">تسجيل عقد إدارة أملاك جديد</h3>
              <p className="text-xs text-slate-400">إضافة مجمع أو عمارة سكنية/تجارية لإدارتها وتحصيل إيجاراتها</p>
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
          {/* Property Name & Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">اسم العقار / المجمع *</label>
              <input
                type="text"
                required
                placeholder="مثال: عمارة النخيل السكنية، مجمع الأمل التجاري..."
                value={propertyName}
                onChange={(e) => setPropertyName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">تصنيف العقار *</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="Residential">سكني (Residential)</option>
                <option value="Commercial">تجاري (Commercial)</option>
                <option value="Mixed">مختلط (Mixed)</option>
              </select>
            </div>
          </div>

          {/* Owner Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">اسم المالك / المؤجر *</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="اسم المالك الكامل..."
                  value={lessorName}
                  onChange={(e) => setLessorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">رقم جوال المالك *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute right-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="05XXXXXXXX"
                  value={lessorPhone}
                  onChange={(e) => setLessorPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 dir-ltr text-right"
                />
              </div>
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

          {/* Management Fees Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">طريقة الأتعاب (السعي)</label>
              <select
                value={feeType}
                onChange={(e) => setFeeType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="PERCENTAGE">نسبة مئوية (%) من التحصيل</option>
                <option value="FIXED_ANNUAL">مبلغ مقطوع سنوياً (ر.س)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                قيمة {feeType === 'PERCENTAGE' ? 'النسبة المئوية (%)' : 'المبلغ السنوي (ر.س)'}
              </label>
              <input
                type="number"
                step="0.1"
                value={feeValue}
                onChange={(e) => setFeeValue(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Revenue & Collection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">الإيراد الإجمالي السنوي المتوقع (ر.س)</label>
              <input
                type="number"
                value={annualRevenue}
                onChange={(e) => setAnnualRevenue(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">المبالغ المحصلة فعلياً حتى الآن (ر.س)</label>
              <input
                type="number"
                value={collectedRevenue}
                onChange={(e) => setCollectedRevenue(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Calculation Preview */}
          <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/50 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block">أتعاب إدارة الأملاك للمكتب:</span>
              <span className="font-extrabold text-sky-400 text-sm">
                {calculatedFeeAmount.toLocaleString('ar-SA')} ر.س
              </span>
            </div>
            <div className="text-left">
              <span className="text-slate-400 block">صافي المحول للمالك:</span>
              <span className="font-extrabold text-emerald-400 text-sm">
                {calculatedNetToOwner.toLocaleString('ar-SA')} ر.س
              </span>
            </div>
          </div>

          {/* Contract Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">تاريخ بداية العقد</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">تاريخ نهاية العقد</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">شروط وملاحظات الإدارة</label>
            <textarea
              rows={2}
              placeholder="اكتب أي ملاحظات أو تفاصيل حول النظافة وصيانة المصاعد والحراسة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
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
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'اعتماد وحفظ العقد'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
