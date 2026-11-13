'use client';
import React from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {LayoutDashboard,MapPinned,Building2,FileSignature,UserCheck,Users,FolderArchive,Grid2X2} from 'lucide-react';
import {useLayout} from '@/context/LayoutContext';
import {useAuth} from '@/context/AuthContext';
const items=[
 {name:'التأجير',href:'/leasing',module:'leasing',icon:Building2},
 {name:'الرئيسية',href:'/dashboard',module:'dashboard',icon:LayoutDashboard},
 {name:'العملاء',href:'/crm',module:'crm',icon:UserCheck},
 {name:'العقارات',href:'/ownership-properties',module:'ownership-properties',icon:Building2},
 {name:'العقود',href:'/contracts',module:'contracts',icon:FileSignature},
 {name:'الموظفون',href:'/employees',module:'employees',icon:Users},
 {name:'الأرشيف',href:'/archive',module:'archive',icon:FolderArchive},
];
export default function MobileBottomNav(){
 const path=usePathname(),{toggleMobileNav,isMobileNavOpen}=useLayout(),{canAccess}=useAuth();
 return <nav aria-label="التنقل السريع للجوال" className="kohl-mobile-dock md:hidden">{items.filter(i=>canAccess(i.module)).slice(0,4).map(item=>{
 const active=path===item.href||(path==='/'&&item.href==='/dashboard'),Icon=item.icon;
 return <Link href={item.href} key={item.href} aria-current={active?'page':undefined} className="kohl-dock-item"><span className="kohl-dock-icon"><Icon size={21} strokeWidth={active?2.3:1.7}/></span><span>{item.name}</span></Link>;
 })}<button type="button" className="kohl-dock-item" aria-expanded={isMobileNavOpen} aria-controls="kohl-mobile-menu" onClick={toggleMobileNav}><span className="kohl-dock-icon"><Grid2X2 size={21} strokeWidth={1.7}/></span><span>المزيد</span></button></nav>;
}
