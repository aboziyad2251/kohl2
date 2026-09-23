'use client';

import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, X, Check, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/lib/types';

const ROLE_BADGE_STYLES: Record<UserRole, { bg: string; text: string; border: string }> = {
  CEO: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  ADMIN: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  HR: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  EMPLOYEE: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
};

export default function ChangePasswordModal() {
  const { currentUser, changePassword, isChangePasswordOpen, closeChangePasswordModal } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const currentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isChangePasswordOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg('');
      setIsSuccess(false);
      setIsShaking(false);
      setTimeout(() => {
        currentInputRef.current?.focus();
      }, 100);
    }
  }, [isChangePasswordOpen]);

  if (!isChangePasswordOpen) return null;

  const badgeStyle = ROLE_BADGE_STYLES[currentUser.role] || ROLE_BADGE_STYLES.EMPLOYEE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentPassword.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور الحالية');
      triggerShake();
      return;
    }

    if (!newPassword.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور الجديدة');
      triggerShake();
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg('يجب ألا تقل كلمة المرور الجديدة عن 4 خانات');
      triggerShake();
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      triggerShake();
      return;
    }

    const res = changePassword(currentPassword, newPassword);

    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        closeChangePasswordModal();
      }, 900);
    } else {
      setErrorMsg(res.error || 'حدث خطأ أثناء تغيير كلمة المرور');
      triggerShake();
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`relative w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden transition-transform duration-200 ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">تغيير كلمة المرور</h3>
              <p className="text-[11px] text-slate-400">تحديث كلمة سر الحساب النشط فوراً</p>
            </div>
          </div>
          <button
            onClick={closeChangePasswordModal}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* User Preview */}
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {currentUser.avatar_initials}
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{currentUser.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">{currentUser.department || currentUser.role_display}</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-right">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                كلمة المرور الحالية *
              </label>
              <div className="relative">
                <input
                  ref={currentInputRef}
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الحالية..."
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pr-9 pl-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  required
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                كلمة المرور الجديدة *
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة..."
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pr-9 pl-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                  required
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                تأكيد كلمة المرور الجديدة *
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور الجديدة..."
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pr-9 pl-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                  required
                />
                <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-2 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {isSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-2 animate-in fade-in font-medium">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>تم تغيير كلمة المرور بنجاح! تم الحفظ في النظام.</span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3">
              <button
                type="button"
                onClick={closeChangePasswordModal}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSuccess}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 active:from-sky-700 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>حفظ كلمة المرور الجديدة</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
