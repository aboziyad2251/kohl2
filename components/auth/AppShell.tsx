'use client';
import { Suspense, useEffect } from 'react';
import {useDraftSession} from '@/lib/drafts/hooks';
import DraftNotice from '@/components/layout/DraftNotice';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { LayoutProvider } from '@/context/LayoutContext';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { AppearanceWorkspace } from '@/components/layout/Appearance';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import PreviewNotice from './PreviewNotice';
import ExportObserver from '@/components/audit/ExportObserver';
import { NavigationProvider } from '@/context/NavigationContext';
import { routeModule } from '@/lib/navigation';
import { AttentionProvider } from '@/context/AttentionContext';
export default function AppShell({ children }: {
    children: React.ReactNode;
}) {
    const auth = useAuth(), path = usePathname(), router = useRouter();
    useDraftSession(auth.currentUser.id,auth.loading,auth.authenticated);
    const publicRoute = path === '/login' || path.startsWith('/auth/') || path.startsWith('/verify/'), portalRoute = path === '/portal' || path.startsWith('/portal/');
    const module = path.startsWith('/financials/daily-reports/legacy') ? 'financials' : routeModule(path);
    const destination = !auth.authenticated ? '/login' : auth.isExternal ? '/portal' : auth.role === 'LEASING' ? '/leasing' : '/dashboard';
    useEffect(() => { if (auth.loading || publicRoute)
        return; if (!auth.authenticated || (auth.isExternal && !portalRoute) || (!auth.isExternal && portalRoute) || (auth.role === 'LEASING' && module !== 'leasing'))
        router.replace(destination); }, [auth.loading, auth.authenticated, auth.isExternal, publicRoute, portalRoute, destination, router, auth.role, module]);
    if (publicRoute)
        return <div className="w-full"><PreviewNotice /><Suspense fallback={<p role="status">جارٍ التحميل…</p>}>{children}</Suspense></div>;
    if (auth.loading)
        return <p className="p-8">جارٍ التحقق من الدخول…</p>;
    if (!auth.authenticated || auth.isExternal !== portalRoute)
        return <p className="p-8">جارٍ التحويل…</p>;
    if (auth.isExternal)
        return <div className="w-full"><PreviewNotice /><Suspense fallback={<p role="status">جارٍ التحميل…</p>}>{children}</Suspense></div>;
    if (!auth.canAccess(module))
        return <p className="p-8">لا تملك صلاحية الدخول لهذه الصفحة.</p>;
    const shell = <NavigationProvider key={auth.currentUser.id}><LayoutProvider><AppearanceWorkspace><Sidebar /><div className="flex-1 flex flex-col min-w-0"><PreviewNotice /><ExportObserver /><Header /><main className="flex-1 p-3.5 sm:p-5 md:p-8 overflow-y-auto pb-24 md:pb-8 min-w-0"><DraftNotice /><Suspense fallback={<p role="status">جارٍ تحميل القسم…</p>}>{children}</Suspense></main></div><MobileBottomNav /></AppearanceWorkspace></LayoutProvider></NavigationProvider>;
    if (auth.role === 'LEASING') return shell;
    return <DataProvider key={auth.currentUser.id}>{auth.isExecutive ? <AttentionProvider key={auth.currentUser.id}>{shell}</AttentionProvider> : shell}</DataProvider>;
}
