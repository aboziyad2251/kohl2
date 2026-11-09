'use client';

import React, {Suspense,useEffect,useRef} from 'react';
import Link from 'next/link';
import { Lock, KeyRound, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLayout } from '@/context/LayoutContext';
import NavigationMenu from '@/components/navigation/NavigationMenu';

interface SidebarContentProps {
  onCloseMobileNav?: () => void;
  isMobileDrawer?: boolean;
}

function SidebarContent({ onCloseMobileNav, isMobileDrawer = false }: SidebarContentProps) {
  const { currentUser, lockSession, openChangePasswordModal } = useAuth();

  return (
    <div className={`kohl-sidebar-content flex flex-col justify-between h-full ${isMobileDrawer ? 'kohl-mobile-menu-content' : ''}`}>
      <div>
        {/* Brand Header */}
        <div className="kohl-nav-brand p-4 md:p-5 border-b border-slate-800 flex items-center justify-between">
          <Link
            href="/dashboard"
            onClick={onCloseMobileNav}
            className="flex items-center gap-3 group transition min-w-0"
          >
            <div className="kohl-nav-logo w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 border border-emerald-500/30 p-1.5 flex items-center justify-center shadow-lg shadow-emerald-950/40 shrink-0 group-hover:border-emerald-400/60 group-hover:shadow-emerald-900/40 transition">
              <img
                src="/kohl-icon.png"
                alt="شعار كحل العقارية"
                className="w-full h-full object-contain filter drop-shadow"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base md:text-lg text-white leading-tight group-hover:text-emerald-300 transition">
                  كحل العقارية
                </span>
              </div>
              <h1 className="text-[11px] md:text-xs text-emerald-400 font-semibold leading-tight truncate">
                نظام إدارة المكتب العقاري
              </h1>
              <p className="text-[10px] text-slate-400 font-medium dir-ltr text-right">
                Kohl Real Estate
              </p>
            </div>
          </Link>

          {/* Close button for mobile drawer */}
          {isMobileDrawer && (
            <button
              onClick={onCloseMobileNav}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <Suspense fallback={<p className="kohl-nav-empty" role="status">جارٍ تحميل الأقسام…</p>}><NavigationMenu onNavigate={onCloseMobileNav} mobile={isMobileDrawer} /></Suspense>


      </div>

      {/* User Profile & Role Footer */}
      <div className="kohl-nav-account p-3.5 md:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 border border-sky-400/40 flex items-center justify-center text-white font-bold text-xs shadow shrink-0">
            {currentUser.avatar_initials}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-white truncate max-w-[120px]">{currentUser.name}</div>
            <div className="text-[10px] text-sky-400 font-medium">{currentUser.role_display}</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              onCloseMobileNav?.();
              openChangePasswordModal();
            }}
            title="تغيير كلمة المرور"
            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-lg transition"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onCloseMobileNav?.();
              lockSession();
            }}
            title="قفل النظام وتسجيل الخروج"
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { isMobileNavOpen, closeMobileNav } = useLayout();
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const element=dialog.current;if(!isMobileNavOpen){element?.close();return;}
    element?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return ()=>{element?.close();document.body.style.overflow=previous;};
  },[isMobileNavOpen]);

  return (
    <>
      {/* Desktop Sticky Sidebar (Auto detected for screens >= 768px) */}
      <aside aria-label="القائمة الرئيسية" className="kohl-desktop-sidebar hidden md:flex md:w-64 lg:w-72 bg-slate-900 border-l border-slate-800 flex-col justify-between h-screen sticky top-0 z-40 select-none overflow-y-auto shrink-0">
        <SidebarContent />
      </aside>

      <dialog ref={dialog} id="kohl-mobile-menu" className="kohl-mobile-menu md:hidden" aria-label="جميع أقسام كحل" onCancel={event=>{event.preventDefault();closeMobileNav();}} onClick={event=>{if(event.target===event.currentTarget)closeMobileNav();}}>
        <div className="kohl-mobile-sheet"><div className="kohl-sheet-handle" aria-hidden="true"/><SidebarContent onCloseMobileNav={closeMobileNav} isMobileDrawer /></div>
      </dialog>
    </>
  );
}
