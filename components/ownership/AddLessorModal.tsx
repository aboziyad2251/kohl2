'use client';

import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Lessor } from '@/lib/types';

interface AddLessorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (lessor: Lessor) => void;
}

export default function AddLessorModal({ isOpen, onClose, onSubmit }: AddLessorModalProps) {
  const [name, setName] = useState('');
  const [nationalIdOrCr, setNationalIdOrCr] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nationalIdOrCr || !phone) return;

    const newLessor: Lessor = {
      id: `les-${Date.now()}`,
      name,
      national_id_or_cr: nationalIdOrCr,
      phone,
      email: email || undefined,
      created_at: new Date().toISOString(),
    };

    onSubmit(newLessor);
    setName('');
    setNationalIdOrCr('');
    setPhone('');
    setEmail('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
            <UserPlus className="w-4 h-4" />
            <span>إضافة مؤجر / مالك جديد</span>
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
            <label className="block text-slate-300 mb-1 font-semibold">اسم المؤجر / الشركة الممالكة *</label>
            <input
              type="text"
              required
              placeholder="مثال: شركة الأفق العقارية / الشيخ عبد الرحمن"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">رقم الهوية الوطنية / السجل التجاري CR *</label>
            <input
              type="text"
              required
              placeholder="1010XXXXXX أو 700XXXXXXX"
              value={nationalIdOrCr}
              onChange={(e) => setNationalIdOrCr(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-semibold">البريد الإلكتروني (اختياري)</label>
            <input
              type="email"
              placeholder="info@domain.sa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-purple-500"
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
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-lg shadow-purple-600/30"
            >
              حفظ وتخزين المالك
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
