'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, Shield, AlertCircle, X, Check, KeyRound } from 'lucide-react';
import { AppUser, UserRole } from '@/lib/types';
import { useAuth, KNOWN_PASSWORDS } from '@/context/AuthContext';

interface PasswordPromptModalProps {
  targetUser: AppUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ROLE_BADGE_STYLES: Record<UserRole, { bg: string; text: string; border: string }> = {
  CEO: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  ADMIN: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  HR: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  EMPLOYEE: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
};

export default function PasswordPromptModal({
  targetUser,
  isOpen,
  onClose,
  onSuccess,
}: PasswordPromptModalProps) {
  const { switchUserWithPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMsg('');
      setIsSuccess(false);
      setIsShaking(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, targetUser]);

  if (!isOpen || !targetUser) return null;

  const badgeStyle = ROLE_BADGE_STYLES[targetUser.role] || ROLE_BADGE_STYLES.EMPLOYEE;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور للمتابعة');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    const result = switchUserWithPassword(targetUser, password);

    if (result.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSuccess?.();
        onClose();
      }, 600);
    } else {
      setErrorMsg(result.error || 'كلمة المرور غير صحيحة');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
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
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">تأكيد كلمة المرور للصلاحية</h3>
              <p className="text-[11px] text-slate-400">التحقق من هوية الحساب للتبديل</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Target Card */}
        <div className="p-6 space-y-5">
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 border border-sky-400/30 flex items-center justify-center text-white font-bold text-sm shadow">
                {targetUser.avatar_initials}
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{targetUser.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                  >
                    {targetUser.role}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {targetUser.department || targetUser.role_display}
                </div>
              </div>
            </div>

            <div className="text-left text-[11px] text-sky-400 font-mono">
              {targetUser.employee_id || targetUser.id}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                كلمة المرور الخاصة بالحساب *
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور..."
                  className={`w-full bg-slate-800/90 border rounded-xl pr-10 pl-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition ${
                    errorMsg
                      ? 'border-rose-500 focus:border-rose-500'
                      : 'border-slate-700 focus:border-sky-500'
                  }`}
                  required
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-white transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
                  <span>تم التحقق بنجاح! جاري التبديل...</span>
                </div>
              )}
            </div>

            {/* Quick Helper Info */}
            <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/60 text-[11px] text-slate-400 flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span>نظام حماية الصلاحيات متطابق للإدارة العليا (Admin / CEO).</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSuccess}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold transition shadow-lg shadow-sky-600/30 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>تأكيد الصلاحية والدخول</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
