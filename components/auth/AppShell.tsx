'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { LayoutProvider } from '@/context/LayoutContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import PreviewNotice from './PreviewNotice';
import { AttentionProvider } from '@/context/AttentionContext';
export default function AppShell({ children }: {
    children: React.ReactNode;
}) {
    const auth = useAuth(), path = usePathname(), router = useRouter();
    const publicRoute = path === '/login' || path.startsWith('/auth/') || path.startsWith('/verify/'), portalRoute = path === '/portal' || path.startsWith('/portal/');
    const module = path.startsWith('/financials') ? 'financials' : path.split('/')[1] || 'dashboard';
    const destination = !auth.authenticated ? '/login' : auth.isExternal ? '/portal' : '/dashboard';
    useEffect(() => { if (auth.loading || publicRoute)
        return; if (!auth.authenticated || (auth.isExternal && !portalRoute) || (!auth.isExternal && portalRoute))
        router.replace(destination); }, [auth.loading, auth.authenticated, auth.isExternal, publicRoute, portalRoute, destination, router]);
    if (publicRoute)
        return <div className="w-full"><PreviewNotice />{children}</div>;
    if (auth.loading)
        return <p className="p-8">جارٍ التحقق من الدخول…</p>;
    if (!auth.authenticated || auth.isExternal !== portalRoute)
        return <p className="p-8">جارٍ التحويل…</p>;
    if (auth.isExternal)
        return <div className="w-full"><PreviewNotice />{children}</div>;
    if (!auth.canAccess(module))
        return <p className="p-8">لا تملك صلاحية الدخول لهذه الصفحة.</p>;
    const shell = <LayoutProvider><Sidebar /><div className="flex-1 flex flex-col min-w-0"><PreviewNotice /><Header /><main className="flex-1 p-3.5 sm:p-5 md:p-8 overflow-y-auto pb-24 md:pb-8 min-w-0">{children}</main></div><MobileBottomNav /></LayoutProvider>;
    return <DataProvider key={auth.currentUser.id}>{auth.isExecutive ? <AttentionProvider key={auth.currentUser.id}>{shell}</AttentionProvider> : shell}</DataProvider>;
}
