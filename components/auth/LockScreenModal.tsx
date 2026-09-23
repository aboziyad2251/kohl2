'use client';

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Building, KeyRound, AlertCircle, Check, Users, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppUser, UserRole } from '@/lib/types';

const ROLE_BADGE_STYLES: Record<UserRole, { bg: string; text: string; border: string }> = {
  CEO: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  ADMIN: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  HR: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  EMPLOYEE: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
};

export default function LockScreenModal() {
  const { isLocked, currentUser, allUsers, unlockSession } = useAuth();
  const [selectedUser, setSelectedUser] = useState<AppUser>(currentUser);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);

  // Sync selected user when currentUser changes
  React.useEffect(() => {
    setSelectedUser(currentUser);
  }, [currentUser]);

  if (!isLocked) return null;

  const targetBadge = ROLE_BADGE_STYLES[selectedUser.role] || ROLE_BADGE_STYLES.EMPLOYEE;

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور لفتح النظام');
      return;
    }

    const res = unlockSession(selectedUser.id, password);
    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setPassword('');
        setIsSuccess(false);
      }, 500);
    } else {
      setErrorMsg(res.error || 'كلمة المرور غير صحيحة');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 text-center relative">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-xl shadow-sky-500/25 mb-3">
            <Building className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white">نظام إدارة المكتب العقاري</h1>
          <p className="text-xs text-sky-400 font-medium mt-0.5">kohl.kohlestate-ksa.online</p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-400 mt-2">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>النظام مقفل - تسجيل الدخول مطلوب</span>
          </div>
        </div>

        {/* Selected User Display */}
        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 mb-5 text-right">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 border border-sky-400/40 flex items-center justify-center text-white font-bold text-sm shadow">
                {selectedUser.avatar_initials}
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{selectedUser.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${targetBadge.bg} ${targetBadge.text} ${targetBadge.border}`}
                  >
                    {selectedUser.role}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {selectedUser.department || selectedUser.role_display}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSwitchingAccount(!isSwitchingAccount)}
              className="text-xs text-sky-400 hover:text-sky-300 transition font-medium flex items-center gap-1"
            >
              <Users className="w-3.5 h-3.5" />
              <span>تبديل</span>
            </button>
          </div>

          {/* Account Picker */}
          {isSwitchingAccount && (
            <div className="mt-3 pt-3 border-t border-slate-700 space-y-1 max-h-48 overflow-y-auto">
              {allUsers.map((u) => {
                const uBadge = ROLE_BADGE_STYLES[u.role] || ROLE_BADGE_STYLES.EMPLOYEE;
                const isCurrent = u.id === selectedUser.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setIsSwitchingAccount(false);
                      setPassword('');
                      setErrorMsg('');
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-right text-xs transition ${
                      isCurrent ? 'bg-sky-600/20 text-white' : 'hover:bg-slate-700/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-sky-400">
                        {u.avatar_initials}
                      </span>
                      <span>{u.name}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded border ${uBadge.bg} ${uBadge.text} ${uBadge.border}`}>
                      {u.role}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="space-y-4 text-right">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              كلمة المرور لتسجيل الدخول *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور..."
                autoFocus
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl pr-10 pl-10 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                required
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3.5 text-slate-400 hover:text-white transition"
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
                <span>تم فتح النظام بنجاح!</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSuccess}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-sky-600/30 transition flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>تسجيل الدخول وفتح النظام</span>
          </button>
        </form>
      </div>
    </div>
  );
}
