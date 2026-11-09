'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useNavigation } from '@/context/NavigationContext';
import { AppearanceSwitch } from '@/components/layout/Appearance';
import { navShortcuts, navItems } from '@/lib/navigation';
import type { WorkspaceStatus } from '@/lib/navigation/workspace';
import { useWorkspaceData } from '@/components/navigation/useWorkspaceData';
import WorkspaceState from '@/components/navigation/WorkspaceState';
export default function SettingsPage() {
  const { canAccess, openChangePasswordModal } = useAuth();
  const { preferences, toggleFavorite, reset } = useNavigation();
  const { data, loading, error, refresh } = useWorkspaceData<WorkspaceStatus>('/api/workspace/status');
  return <div className="workspace-page" dir="rtl"><div className="workspace-heading"><div><h1>الإعدادات والتكاملات</h1><p>تفضيلات مساحة العمل وروابط الإدارة وحالة الإعدادات المتاحة.</p></div><button type="button" disabled={loading} onClick={refresh}>تحديث الحالة</button></div>
    <div className="workspace-cards"><section className="workspace-card"><h2>مساحة العمل والحساب</h2><div className="workspace-shortcuts"><AppearanceSwitch /><button type="button" onClick={openChangePasswordModal}>تغيير كلمة المرور</button><Link href="/users-access">المستخدمون والصلاحيات وسياسة انتهاء الإيجار ←</Link></div></section>
      <section className="workspace-card"><h2>اختصارات الخدمات</h2><div className="workspace-shortcuts">{navShortcuts.filter(item => canAccess(item.moduleKey)).map(item => <Link key={item.id} href={item.href}>{item.label} ←</Link>)}</div></section></div>
    <section className="workspace-card"><div className="workspace-heading"><div><h2>المفضلة</h2><p>تُحفظ لحسابك على هذا المتصفح. يمكن أيضاً استخدام النجمة بجانب كل قسم.</p></div><button type="button" onClick={reset}>إعادة ضبط تفضيلات القائمة</button></div><div className="workspace-favorites">{[...navItems, ...navShortcuts].filter(item => canAccess(item.moduleKey)).map(item => <label key={item.id}><input type="checkbox" checked={preferences.favorites.includes(item.id)} onChange={() => toggleFavorite(item.id)} />{item.label}</label>)}</div></section>
    <WorkspaceState loading={loading} error={error} refresh={refresh} />
    {data && <section className="workspace-card"><h2>التكاملات</h2><p>توفر الإعدادات لا يثبت اتصال الخدمة الخارجية. لا تُعرض مفاتيح أو كلمات مرور هنا.</p><dl className="workspace-status-list">
      <div><dt>قاعدة البيانات</dt><dd>{data.database ? 'نجحت قراءة اختبارية بصلاحيات حسابك' : 'تعذرت القراءة الاختبارية — تحقق من الاتصال والصلاحيات'}</dd></div>
      <div><dt>هاتف</dt><dd>{data.hatif.enabled ? data.hatif.configured ? 'الاستقبال مفعّل وإعداد التوقيع متوفر' : 'الاستقبال مفعّل لكن إعداد التوقيع غير مكتمل' : 'الاستقبال غير مفعّل'}<p>{!data.hatif.observationAvailable ? 'تعذر قراءة سجل أنشطة هاتف.' : data.hatif.lastRecordedActivity ? `آخر نشاط مسجل باسم هاتف: ${new Date(data.hatif.lastRecordedActivity).toLocaleString('ar-SA', { calendar: 'gregory', timeZone: 'Asia/Riyadh' })}` : 'لم يُعثر على نشاط مسجل باسم هاتف.'}</p><small>لم يتم اختبار الاتصال الخارجي أو إرسال حدث تجريبي.</small></dd></div>
      <div><dt>مستشار التقارير</dt><dd>{data.aiConfigured ? 'إعداد مزود متوفر؛ لم يتم اختبار التوليد' : 'لا يوجد إعداد مزود؛ يتاح الملخص الحسابي فقط'}</dd></div>
      <div><dt>الدخول عبر Google</dt><dd>{data.googleEnabled ? 'مفعّل في الإعدادات؛ لم يتم اختبار تسجيل الدخول' : 'غير مفعّل'}</dd></div>
      <div><dt>استعادة كلمة المرور</dt><dd>{data.recoveryEnabled ? 'مفعّلة في الإعدادات؛ لم يتم اختبار إرسال البريد' : 'غير مفعّلة'}</dd></div>
      <div><dt>منصة إيجار</dt><dd>تتوفر إدارة العقود داخلياً؛ حالة الربط الخارجي غير مقاسة. <Link href="/contracts">فتح العقود ←</Link></dd></div>
      <div><dt>الفوترة الضريبية</dt><dd>النماذج متاحة؛ تجهيز QR لا يعني اكتمال التكامل الضريبي. <Link href="/bills-forms">فتح الفواتير والنماذج ←</Link></dd></div>
    </dl><p>آخر فحص: {new Date(data.checkedAt).toLocaleString('ar-SA', { calendar: 'gregory', timeZone: 'Asia/Riyadh' })}</p></section>}
  </div>;
}
