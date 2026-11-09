'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {draftEvent,hasPageDraft,clearDraftScope} from '@/lib/drafts/store';
export default function DraftNotice(){const {currentUser}=useAuth(),path=usePathname(),[saved,setSaved]=useState(false);useEffect(()=>{const refresh=()=>setSaved(hasPageDraft(currentUser.id,path));refresh();window.addEventListener(draftEvent,refresh);return()=>window.removeEventListener(draftEvent,refresh);},[currentUser.id,path]);return saved?<p role="status" className="mb-4 rounded-xl border border-amber-700/20 bg-amber-50 px-4 py-2 text-xs text-amber-900 print:hidden">بيانات هذه الصفحة محفوظة مؤقتاً في جلستك. يمكنك التنقّل والعودة للمتابعة. المرفقات تحتاج إعادة اختيار بعد تحديث المتصفح. <button type="button" className="underline mr-2" onClick={()=>{if(window.confirm('مسح مسودات هذه الصفحة والبدء من جديد؟ لن تُحذف السجلات المحفوظة.')){clearDraftScope(currentUser.id,path);window.location.reload();}}}>مسح مسودات الصفحة</button></p>:null;}
