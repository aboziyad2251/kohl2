'use client';

import React from 'react';
import { Bell, Search, Globe, Shield, Calendar } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({
  title = 'نظام إدارة العقود والملكية العقارية',
  subtitle = 'لوحة التحكم والعمليات المباشرة',
}: HeaderProps) {
  const currentDate = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-8 py-4 sticky top-0 z-30 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-white leading-tight">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Date Display */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
          <Calendar className="w-3.5 h-3.5 text-sky-400" />
          <span>{currentDate}</span>
        </div>

        {/* Global Search input */}
        <div className="relative hidden lg:block w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث عن عقار، عقد، أو صك..."
            className="w-full bg-slate-800/90 border border-slate-700 rounded-lg pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Notifications Button */}
        <button
          className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          title="الإشعارات والتنبيهات"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400"></span>
        </button>

        {/* Ejar Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <Shield className="w-3.5 h-3.5" />
          <span>ربط إيجار نشط</span>
        </div>
      </div>
    </header>
  );
}
