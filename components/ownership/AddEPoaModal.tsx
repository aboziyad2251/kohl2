'use client';

import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { EPoa, Lessor, Representative } from '@/lib/types';

interface AddEPoaModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessors: Lessor[];
  representatives: Representative[];
  onSubmit: (poa: EPoa) => void;
}

export default function AddEPoaModal({
  isOpen,
  onClose,
  lessors,
  representatives,
  onSubmit,
}: AddEPoaModalProps) {
  const [poaNumber, setPoaNumber] = useState('');
  const [grantorId, setGrantorId] = useState('');
  const [attorneyId, setAttorneyId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [scopeDetails, setScopeDetails] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poaNumber || !grantorId || !attorneyId || !expiryDate) return;

    const grantor = lessors.find((l) => l.id === grantorId);
    const attorney = representatives.find((r) => r.id === attorneyId);

    const newPoa: EPoa = {
      id: `epoa-${Date.now()}`,
      poa_number: poaNumber,
      grantor_id: grantorId,
      attorney_id: attorneyId,
      issue_date: issueDate,
      expiry_date: expiryDate,
      scope_details: scopeDetails || 'تفويض كامل لإبرام عقود الإيجار وتمثيل المؤجر.',
      status: 'Active',
      grantor,
      attorney,
      created_at: new Date().toISOString(),
    };

    onSubmit(newPoa);
    setPoaNumber('');
    setGrantorId('');
    setAttorneyId('');
    setExpiryDate('');
    setScopeDetails('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>إضافة وكالة إلكترونية (E-POA)</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-semibold">رقم الوكالة E-POA *</label>
            <input
              type="text"
              required
              placeholder="EPOA-2024-XXXX"
              value={poaNumber}
              onChange={(e) => setPoaNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">المؤجر (المُوكّل) *</label>
            <select
              required
              value={grantorId}
              onChange={(e) => setGrantorId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">اختر المالك / المؤجر...</option>
              {lessors.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.national_id_or_cr})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">الوكيل الممثل (الموكّل له) *</label>
            <select
              required
              value={attorneyId}
              onChange={(e) => setAttorneyId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-sky-500"
            >
              <option value="">اختر الوكيل الممثل...</option>
              {representatives.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.national_id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">تاريخ الإصدار *</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">تاريخ الانتهاء *</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">تفاصيل الصلاحية والنطاق</label>
            <textarea
              rows={2}
              placeholder="صلاحية إبرام العقود وتوثيقها عبر منصة إيجار والتوقيع نيابة عن المؤجر..."
              value={scopeDetails}
              onChange={(e) => setScopeDetails(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-sky-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30"
            >
              حفظ الوكالة الإلكترونية
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
