'use client';
import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

// The external portal has its own asset namespace. Cross-app navigation is a
// full page load so the restored main application's bundles are never mixed.
export default function ExternalPortalShell({children}:{children:React.ReactNode}) {
    const auth=useAuth();
    useEffect(()=>{
        if(auth.loading)return;
        if(!auth.authenticated)window.location.replace('/login');
        else if(!auth.isExternal)window.location.replace('/dashboard');
    },[auth.loading,auth.authenticated,auth.isExternal]);
    if(auth.loading||!auth.authenticated||!auth.isExternal)return <p className="p-8">جارٍ التحقق من الدخول…</p>;
    return <div className="w-full">{children}</div>;
}
