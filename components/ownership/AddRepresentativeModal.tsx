'use client';

import React, { useState } from 'react';
import { UserCheck, X } from 'lucide-react';
import { Representative } from '@/lib/types';

interface AddRepresentativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rep: Representative) => void;
}

export default function AddRepresentativeModal({ isOpen, onClose, onSubmit }: AddRepresentativeModalProps) {
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ePoaNumber, setEPoaNumber] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nationalId || !phone) return;

    const newRep: Representative = {
      id: `rep-${Date.now()}`,
      name,
      national_id: nationalId,
      phone,
      email: email || undefined,
      e_poa_number: ePoaNumber || undefined,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };

    onSubmit(newRep);
    setName('');
    setNationalId('');
    setPhone('');
    setEmail('');
    setEPoaNumber('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <UserCheck className="w-4 h-4" />
            <span>إضافة ممثل / وكيل عقاري جديد</span>
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
            <label className="block text-slate-300 mb-1 font-semibold">اسم الوكيل / الممثل *</label>
            <input
              type="text"
              required
              placeholder="مثال: م. طارق الغامدي"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">رقم الهوية الوطنية *</label>
            <input
              type="text"
              required
              placeholder="10XXXXXXXX"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">رقم الجوال *</label>
            <input
              type="tel"
              required
              placeholder="05XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">رقم الوكالة الإلكترونية المرتبطة (اختياري)</label>
            <input
              type="text"
              placeholder="POA-XXXXXX"
              value={ePoaNumber}
              onChange={(e) => setEPoaNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">البريد الإلكتروني (اختياري)</label>
            <input
              type="email"
              placeholder="rep@domain.sa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
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
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-lg shadow-amber-600/30"
            >
              حفظ وتخزين الوكيل
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
