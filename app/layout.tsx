import './globals.css';
import type { Metadata, Viewport } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import { DataProvider } from '@/context/DataContext';
import { AuthProvider } from '@/context/AuthContext';
import { LayoutProvider } from '@/context/LayoutContext';

export const metadata: Metadata = {
  title: 'نظام إدارة المكتب العقاري | Real Estate Office Management',
  description: 'منظومة إدارية متكاملة لإدارة العقارات، العقود (إيجار)، الموظفين والدوام، ونظام علاقات العملاء CRM',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#020617',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex antialiased selection:bg-sky-500/20 selection:text-sky-300">
        <AuthProvider>
          <DataProvider>
            <LayoutProvider>
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main className="flex-1 p-3.5 sm:p-5 md:p-8 overflow-y-auto pb-24 md:pb-8 min-w-0">
                  {children}
                </main>
              </div>
              <MobileBottomNav />
            </LayoutProvider>
          </DataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
