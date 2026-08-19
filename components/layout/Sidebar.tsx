'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileSignature,
  Building2,
  FileCheck,
  Building,
  ShieldCheck,
  FileText,
  UserCheck,
  ChevronRight,
  Wallet,
  Sparkles,
  Briefcase,
  ClipboardList,
} from 'lucide-react';

const navItems = [
  {
    name: 'لوحة التحكم القيادية',
    href: '/dashboard',
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: 'طلبات العملاء (سكني/تجاري)',
    href: '/customer-orders',
    icon: ClipboardList,
    badge: 'جديد 📋',
  },
  {
    name: 'إدارة الأملاك والتشغيل',
    href: '/property-management',
    icon: Building,
    badge: 'جديد 🏢',
  },
  {
    name: 'الأرباح والمعاملات المالية',
    href: '/financials/earnings',
    icon: Wallet,
    badge: 'مالي',
  },
  {
    name: 'التقرير اليومي ومستشار AI',
    href: '/financials/daily-reports',
    icon: Sparkles,
    badge: 'ذكاء AI',
  },
  {
    name: 'مركز العقود والإيجارات',
    href: '/contracts',
    icon: FileSignature,
    badge: 'جديد',
  },
  {
    name: 'الملكية والعقارات والوكالات',
    href: '/ownership-properties',
    icon: Building2,
    badge: null,
  },
  {
    name: 'اتفاقيات الوساطة (إيجار)',
    href: '/brokerage-agreements',
    icon: FileCheck,
    badge: 'معتمد',
  },
  {
    name: 'الخدمات العامة والمعاملات',
    href: '/general-services',
    icon: Briefcase,
    badge: 'خدمات',
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col justify-between h-screen sticky top-0 z-40 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white leading-tight">نظام إدارة المكتب</h1>
            <p className="text-xs text-sky-400 font-medium">office.mabotargagh.online</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 tracking-wider">
            القائمة الرئيسية
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname === '/' && item.href === '/dashboard');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 font-semibold shadow-inner'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-600 rotate-180" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick System Status */}
        <div className="mx-4 mt-6 p-3.5 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              خادم Supabase VPS
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
          <p className="text-[11px] text-slate-400 dir-ltr text-right">IP: 76.13.40.119</p>
        </div>
      </div>

      {/* User Profile / Office Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 font-bold text-sm">
            م.ع
          </div>
          <div>
            <div className="text-xs font-semibold text-white">مكتب العقارات المعتمد</div>
            <div className="text-[10px] text-slate-400">ترخيص إيجار رقم #88921</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
