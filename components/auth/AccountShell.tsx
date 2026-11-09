'use client';
import { usePathname } from 'next/navigation';
// These public account routes perform their own session/profile validation.
// No internal app shell, navigation or business data provider is loaded here.
export default function AccountShell({children}:{children:React.ReactNode}) {
    const pathname = usePathname();
    if (!['/auth/forgot-password', '/auth/set-password'].includes(pathname)) return null;
    return <div className="w-full">{children}</div>;
}
