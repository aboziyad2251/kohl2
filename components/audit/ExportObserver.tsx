'use client';
import { useEffect } from 'react';
import { logExport,nativePrintIsAudited,nativeDownloadIsAudited } from '@/lib/audit/client';
export default function ExportObserver(){useEffect(()=>{
 const print=()=>{if(nativePrintIsAudited())return;void logExport('browser-print.pdf');};
 const download=(e:MouseEvent)=>{if(nativeDownloadIsAudited())return;const a=e.target instanceof Element?e.target.closest('a[download]'):null;if(a instanceof HTMLAnchorElement)void logExport(a.download||'download');};
 window.addEventListener('beforeprint',print);document.addEventListener('click',download,true);
 return()=>{window.removeEventListener('beforeprint',print);document.removeEventListener('click',download,true);};
 },[]);return null;}
