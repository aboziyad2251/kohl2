'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Search,
  Calendar,
  Shield,
  Users,
  ChevronDown,
  Check,
  UserCheck,
  ShieldAlert,
  Lock,
  LogOut,
  KeyRound,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLayout } from '@/context/LayoutContext';
import { AppUser, UserRole } from '@/lib/types';
import PasswordPromptModal from '@/components/auth/PasswordPromptModal';
import LockScreenModal from '@/components/auth/LockScreenModal';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

const ROLE_BADGE_STYLES: Record<UserRole, { bg: string; text: string; border: string }> = {
  CEO: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  ADMIN: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
  HR: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  EMPLOYEE: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
};

export default function Header({
  title = 'نظام إدارة العقود والملكية العقارية',
  subtitle = 'لوحة التحكم والعمليات المباشرة',
}: HeaderProps) {
  const {
    currentUser,
    allUsers,
    role,
    actingOnBehalfOf,
    setActingOnBehalfOf,
    isExecutive,
    lockSession,
    openChangePasswordModal,
  } = useAuth();

  const { toggleMobileNav, isMobileNavOpen } = useLayout();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [selectedTargetUser, setSelectedTargetUser] = useState<AppUser | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const currentDate = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const badgeStyle = ROLE_BADGE_STYLES[role] || ROLE_BADGE_STYLES.EMPLOYEE;

  return (
    <>
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-3.5 sm:px-6 md:px-8 py-3 sticky top-0 z-30 flex items-center justify-between">
        {/* Left / Title area */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Mobile Hamburger Drawer Trigger */}
          <button
            onClick={toggleMobileNav}
            className="flex md:hidden p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition shrink-0"
            title="القائمة الرئيسية"
            aria-label="القائمة الرئيسية"
          >
            {isMobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base md:text-xl font-bold text-white leading-tight truncate max-w-[130px] sm:max-w-xs md:max-w-none">
              {title}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 hidden sm:block truncate">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right / Actions area */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Date Display (Desktop) */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>{currentDate}</span>
          </div>

          {/* Global Search input (Large Desktop) */}
          <div className="relative hidden lg:block w-48 xl:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث سريع..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-lg pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          {/* Ejar Status Badge (Tablet & Desktop) */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <Shield className="w-3.5 h-3.5" />
            <span>إيجار نشط</span>
          </div>

          {/* Change Password Button in Header */}
          <button
            onClick={openChangePasswordModal}
            title="تغيير كلمة المرور الخاصة بحسابك"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-sky-400 transition"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          {/* Lock Session Button */}
          <button
            onClick={lockSession}
            title="قفل النظام وتسجيل الخروج"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-amber-400 transition"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* Role & User Switcher Button & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
              className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-right transition shadow-sm"
              title="تبديل حساب المستخدم ومستوى الصلاحيات"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {currentUser.avatar_initials}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-white leading-tight flex items-center gap-1.5">
                  <span className="truncate max-w-[110px]">{currentUser.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">صلاحية: {currentUser.role_display}</div>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  isSwitcherOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* User & Role Dropdown Menu */}
            {isSwitcherOpen && (
              <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-24px)] rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      <span>تبديل مستوى الصلاحية والمستخدم</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      اختر حساباً لتجربة الصلاحيات (Admin, CEO, HR, Employee)
                    </p>
                  </div>
                </div>

                <div className="py-1 space-y-1 max-h-80 overflow-y-auto">
                  {allUsers.map((user) => {
                    const isSelected = user.id === currentUser.id;
                    const uBadge = ROLE_BADGE_STYLES[user.role] || ROLE_BADGE_STYLES.EMPLOYEE;
                    return (
                      <button
                        key={user.id}
                        onClick={() => {
                          if (user.id === currentUser.id) {
                            setIsSwitcherOpen(false);
                            return;
                          }
                          setSelectedTargetUser(user);
                          setIsSwitcherOpen(false);
                          setIsPasswordModalOpen(true);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition ${
                          isSelected
                            ? 'bg-sky-600/15 border border-sky-500/30 text-white'
                            : 'hover:bg-slate-800/80 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-sky-400 shrink-0">
                            {user.avatar_initials}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                              <span className="truncate max-w-[130px]">{user.name}</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded border ${uBadge.bg} ${uBadge.text} ${uBadge.border}`}
                              >
                                {user.role}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">{user.department}</div>
                          </div>
                        </div>
                        {isSelected ? (
                          <Check className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Task Delegation banner for Executive */}
                {isExecutive && (
                  <div className="mt-2 pt-2 border-t border-slate-800 px-3 py-2 bg-slate-800/40 rounded-xl">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        النيابة وتفويض الصلاحيات
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        متاح
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      يمكن للرئيس التنفيذي والمسؤول التنفيذ والاعتماد بالنيابة عن أي موظف في كافة الأقسام.
                    </p>
                  </div>
                )}

                {/* Action Buttons in Dropdown Footer */}
                <div className="mt-2 pt-1.5 border-t border-slate-800 space-y-1">
                  <button
                    onClick={() => {
                      setIsSwitcherOpen(false);
                      openChangePasswordModal();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-sky-400 hover:bg-slate-800 transition"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-sky-400" />
                    <span>تغيير كلمة المرور لحسابي</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSwitcherOpen(false);
                      lockSession();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>قفل الجلسة (تسجيل خروج)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Password Confirmation Modal on Switch */}
      <PasswordPromptModal
        targetUser={selectedTargetUser}
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setSelectedTargetUser(null);
        }}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal />

      {/* Lock Screen Modal when Session is Locked */}
      <LockScreenModal />
    </>
  );
}
