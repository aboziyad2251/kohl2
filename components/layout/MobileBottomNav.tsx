'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UserCheck,
  Users,
  FileSignature,
  Menu,
} from 'lucide-react';
import { useLayout } from '@/context/LayoutContext';

interface BottomNavItem {
  name: string;
  href: string;
  icon: any;
}

const mainNavItems: BottomNavItem[] = [
  {
    name: 'الرئيسية',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'الـ CRM',
    href: '/crm',
    icon: UserCheck,
  },
  {
    name: 'الموظفين',
    href: '/employees',
    icon: Users,
  },
  {
    name: 'العقود',
    href: '/contracts',
    icon: FileSignature,
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { toggleMobileNav, isMobileNavOpen } = useLayout();

  return (
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-2 py-1.5 justify-around items-center select-none shadow-2xl">
      {mainNavItems.map((item) => {
        const isActive = pathname === item.href || (pathname === '/' && item.href === '/dashboard');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 ${
              isActive
                ? 'text-sky-400 font-bold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              {isActive && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sky-400"></span>
              )}
            </div>
            <span className="text-[10px] mt-1 leading-none">{item.name}</span>
          </Link>
        );
      })}

      {/* Menu Drawer Toggle Button */}
      <button
        onClick={toggleMobileNav}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 ${
          isMobileNavOpen
            ? 'text-sky-400 font-bold'
            : 'text-slate-400 hover:text-slate-200 font-medium'
        }`}
      >
        <div className="relative">
          <Menu className={`w-5 h-5 transition-transform ${isMobileNavOpen ? 'scale-110' : ''}`} />
          {isMobileNavOpen && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sky-400"></span>
          )}
        </div>
        <span className="text-[10px] mt-1 leading-none">القائمة</span>
      </button>
    </nav>
  );
}
