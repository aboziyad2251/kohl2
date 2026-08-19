import './globals.css';
import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { DataProvider } from '@/context/DataContext';

export const metadata: Metadata = {
  title: 'نظام إدارة المكتب العقاري | Real Estate Office Management',
  description: 'منظومة إدارية متكاملة لإدارة العقارات، العقود (إيجار)، الملكية والوكالات الإلكترونية',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex antialiased">
        <DataProvider>
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
          </div>
        </DataProvider>
      </body>
    </html>
  );
}

