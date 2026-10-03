import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import AppShell from '@/components/auth/AppShell';

export const metadata: Metadata = {
  title: {
    default: 'كحل العقارية | نظام إدارة المكتب العقاري',
    template: '%s | كحل العقارية - نظام إدارة المكتب العقاري',
  },
  description: 'منظومة كحل العقارية المتكاملة لإدارة المكتب العقاري، العقود (إيجار)، إدارة الأملاك والتشغيل، شؤون الموظفين، ونظام علاقات العملاء CRM',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/kohl-icon.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/kohl-icon.png',
  },
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
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
