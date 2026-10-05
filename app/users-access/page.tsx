'use client';
import { useCallback, useEffect, useState } from 'react';
import { portalRequest } from '@/lib/portal/client';
import { AccessData, AccessUser, ManagedRole, roleLabels } from '@/lib/portal/types';
type Form = {
    user_id?: string;
    employee_id?: string;
    email: string;
    password?: string;
    full_name: string;
    mobile: string;
    national_id_or_iqama: string;
    role: ManagedRole;
    owners: {
        property_id: string;
        ownership_share: number;
    }[];
    leases: string[];
    broker_contracts: string[];
    agreement_id?: string;
    agreement: {
        agreement_number: string;
        commission_type: 'PERCENTAGE' | 'FIXED';
        commission_value: number;
        percentage_basis: 'DEAL_VALUE' | 'OFFICE_COMMISSION' | null;
    };
};
const fresh = (): Form => ({ email: '', full_name: '', mobile: '', national_id_or_iqama: '', role: 'TENANT', owners: [], leases: [], broker_contracts: [], agreement: { agreement_number: '', commission_type: 'PERCENTAGE', commission_value: 2.5, percentage_basis: 'DEAL_VALUE' } });
export default function UsersAccess() {
    const [en, setEn] = useState(false), [data, setData] = useState<AccessData | null>(null), [form, setForm] = useState<Form | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [whatsapp, setWhatsapp] = useState('');
    const t = (ar: string, english: string) => en ? english : ar;
    const load = useCallback(async () => { try {
        setData(await portalRequest<AccessData>('/api/access/users'));
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Unable to load');
    } }, []);
    useEffect(() => { void load(); }, [load]);
    const run = async (path: string, payload: unknown) => { setBusy(true); setMessage(''); try {
        const result = await portalRequest<{
            message?: string;
            whatsapp?: string;
        }>(path, { method: 'POST', body: JSON.stringify(payload) });
        setMessage(result.message || t('تم الحفظ', 'Saved'));
        if (result.whatsapp)
            setWhatsapp(result.whatsapp);
        await load();
        return true;
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : 'Unable to save');
        return false;
    }
    finally {
        setBusy(false);
    } };
    const edit = (user: AccessUser) => { if (!['BROKER', 'OWNER', 'TENANT', 'EMPLOYEE'].includes(user.role))
        return; setForm({ user_id: user.id, employee_id: user.employee_id, email: user.email, full_name: user.full_name, mobile: user.mobile, national_id_or_iqama: user.national_id_or_iqama || '', role: user.role as ManagedRole, owners: user.owners.filter(x => !x.effective_to || x.effective_to >= new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })).map(x => ({ property_id: x.property_id, ownership_share: x.ownership_share })), leases: user.leases.map(x => x.contract_id), broker_contracts: user.broker_contracts.map(x => x.contract_id), agreement_id: user.agreements[0]?.id, agreement: fresh().agreement }); };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
    return <div dir={en ? 'ltr' : 'rtl'} className="portal-surface rounded-2xl p-4 sm:p-6 space-y-5">
  <header className="flex flex-wrap gap-3 items-center"><h1 className="text-2xl font-bold flex-1">{t('المستخدمون والصلاحيات', 'Users & Access')}</h1><button onClick={() => setEn(!en)}>{en ? 'العربية' : 'English'}</button><button className="portal-button" onClick={() => { setForm(fresh()); setWhatsapp(''); }}>{t('إنشاء مستخدم', 'Create user')}</button></header>
  {message && <p role="status" className="portal-card">{message}</p>}
  {whatsapp && <div className="portal-card"><p className="mb-3">{whatsapp}</p><button onClick={async () => { try {
        await navigator.clipboard.writeText(whatsapp);
        setMessage(t('تم نسخ رسالة واتساب', 'WhatsApp message copied'));
    }
    catch {
        setMessage(t('حدد النص وانسخه', 'Select and copy the text'));
    } }}>{t('نسخ رسالة واتساب', 'Copy WhatsApp message')}</button></div>}
  {form && <form className="portal-card grid sm:grid-cols-2 gap-4" onSubmit={async (e) => { e.preventDefault(); const payload = { ...form, agreement_id: form.agreement_id || undefined, agreement: form.role === 'BROKER' && !form.agreement_id ? form.agreement : undefined }; if (await run('/api/access/users', payload))
            setForm(null); }}>
   <h2 className="sm:col-span-2 text-xl font-bold">{form.user_id ? t('تعديل المستخدم والروابط', 'Edit user and links') : t('إنشاء مستخدم', 'Create user')}</h2>
   <label>{t('الاسم الكامل', 'Full name')}<input className="portal-input" required minLength={2} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}/></label>
   <label>{t('الجوال', 'Saudi mobile')}<input className="portal-input" type="tel" placeholder="05xxxxxxxx" pattern="05[0-9]{8}" required value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })}/></label>
   <label>{t('البريد الإلكتروني', 'Email')}<input className="portal-input" type="email" autoComplete="off" required readOnly={!!form.user_id} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label>
   {!form.user_id && <label>{t('كلمة المرور', 'Password')}<input className="portal-input" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })}/><p className="text-sm mt-2">{t('12 حرفاً على الأقل. أرسل كلمة المرور للمستخدم بشكل خاص؛ يمكنه الدخول مباشرة دون دعوة بريدية.', 'At least 12 characters. Share the password privately; the user can sign in immediately without an email invitation.')}</p></label>}
   <label>{t('الهوية / الإقامة (اختياري)', 'National ID / Iqama (optional)')}<input className="portal-input" pattern="[0-9]{10}" value={form.national_id_or_iqama} onChange={e => setForm({ ...form, national_id_or_iqama: e.target.value })}/></label>
   <label>{t('الدور', 'Role')}<select className="portal-input" disabled={!!form.user_id} value={form.role} onChange={e => setForm({ ...fresh(), email: form.email, password: form.password, full_name: form.full_name, mobile: form.mobile, national_id_or_iqama: form.national_id_or_iqama, role: e.target.value as ManagedRole })}>{(['EMPLOYEE', 'TENANT', 'OWNER', 'BROKER'] as const).map(role => <option key={role} value={role}>{en ? role : roleLabels[role]}</option>)}</select></label>
   {form.role === 'EMPLOYEE' && <label className="sm:col-span-2">{t('سجل الموظف', 'Employee record')}<select className="portal-input" required disabled={!!form.user_id} value={form.employee_id || ''} onChange={e => { const employee = data?.employees.find(x => x.id === e.target.value); setForm({ ...form, employee_id: employee?.id, full_name: employee?.name || form.full_name, email: form.user_id ? form.email : employee?.email || form.email, mobile: employee?.phone || form.mobile }); }}><option value="">{t('اختر الموظف', 'Select employee')}</option>{data?.employees.filter(employee => employee.status === 'ACTIVE' && !data.users.some(user => user.employee_id === employee.id && user.id !== form.user_id)).map(employee => <option key={employee.id} value={employee.id}>{employee.employee_number} — {employee.name}</option>)}</select><p className="text-sm mt-2">{t('أضف الموظف الجديد في صفحة الموظفين أولاً، ثم اختر سجله هنا لإنشاء بيانات الدخول.', 'Add new staff on the Employees page first, then select their record here to create login details.')} <a className="underline" href="/employees">{t('فتح الموظفين', 'Open Employees')}</a></p></label>}
   {form.role === 'OWNER' && <fieldset className="sm:col-span-2 space-y-2"><legend>{t('العقارات ونسبة الملكية', 'Properties and ownership share')}</legend>{data?.properties.map(property => { const link = form.owners.find(x => x.property_id === property.id); return <div key={property.id} className="flex gap-3 items-center"><label className="flex-1"><input type="checkbox" checked={!!link} onChange={e => setForm({ ...form, owners: e.target.checked ? [...form.owners, { property_id: property.id, ownership_share: 100 }] : form.owners.filter(x => x.property_id !== property.id) })}/> {property.name}</label>{link && <label>{t('النسبة %', 'Share %')}<input className="portal-input w-28" aria-label={`${property.name} %`} type="number" required min="0.0001" max="100" step="0.0001" value={link.ownership_share} onChange={e => setForm({ ...form, owners: form.owners.map(x => x.property_id === property.id ? { ...x, ownership_share: Number(e.target.value) } : x) })}/></label>}</div>; })}</fieldset>}
   {form.role === 'TENANT' && <label className="sm:col-span-2">{t('عقد الإيجار الساري', 'Current active lease')}<select className="portal-input" required value={form.leases[0] || ''} onChange={e => setForm({ ...form, leases: [e.target.value] })}><option value="">{t('اختر العقد', 'Select lease')}</option>{data?.contracts.filter(c => ['active', 'ساري'].includes(c.status.toLowerCase()) && c.start_date <= today && c.end_date >= today).map(c => <option key={c.id} value={c.id}>{c.number} — {c.tenant_name}</option>)}</select><p className="text-sm mt-2">{t('ربط الوحدة التفصيلي سيضاف في مرحلة بوابة المستأجر.', 'Unit details will be linked in the tenant portal phase.')}</p></label>}
   {form.role === 'BROKER' && <><label>{t('الاتفاقية', 'Agreement')}<select className="portal-input" value={form.agreement_id || ''} onChange={e => setForm({ ...form, agreement_id: e.target.value || undefined })}><option value="">{t('إنشاء اتفاقية جديدة', 'Create agreement')}</option>{data?.users.find(u => u.id === form.user_id)?.agreements.map(a => <option key={a.id} value={a.id}>{a.agreement_number}</option>)}</select></label>
    {!form.agreement_id && <><label>{t('رقم الاتفاقية', 'Agreement number')}<input className="portal-input" required value={form.agreement.agreement_number} onChange={e => setForm({ ...form, agreement: { ...form.agreement, agreement_number: e.target.value } })}/></label><label>{t('نوع العمولة', 'Commission type')}<select className="portal-input" value={form.agreement.commission_type} onChange={e => setForm({ ...form, agreement: { ...form.agreement, commission_type: e.target.value as 'PERCENTAGE' | 'FIXED', percentage_basis: e.target.value === 'FIXED' ? null : 'DEAL_VALUE' } })}><option value="PERCENTAGE">{t('نسبة مئوية', 'Percentage')}</option><option value="FIXED">{t('مبلغ ثابت (ريال)', 'Fixed SAR')}</option></select></label><label>{t('قيمة العمولة', 'Commission value')}<input className="portal-input" required type="number" min="0" step="0.01" max={form.agreement.commission_type === 'PERCENTAGE' ? 100 : undefined} value={form.agreement.commission_value} onChange={e => setForm({ ...form, agreement: { ...form.agreement, commission_value: Number(e.target.value) } })}/></label>{form.agreement.commission_type === 'PERCENTAGE' && <label>{t('أساس النسبة', 'Percentage basis')}<select className="portal-input" value={form.agreement.percentage_basis || 'DEAL_VALUE'} onChange={e => setForm({ ...form, agreement: { ...form.agreement, percentage_basis: e.target.value as 'DEAL_VALUE' | 'OFFICE_COMMISSION' } })}><option value="DEAL_VALUE">{t('قيمة الصفقة', 'Deal value')}</option><option value="OFFICE_COMMISSION">{t('عمولة المكتب', 'Office commission')}</option></select></label>}</>}
    <fieldset className="sm:col-span-2"><legend>{t('العقود التي توسط فيها', 'Brokered contracts')}</legend>{data?.contracts.map(c => <label key={c.id} className="block my-2"><input type="checkbox" checked={form.broker_contracts.includes(c.id)} onChange={e => setForm({ ...form, broker_contracts: e.target.checked ? [...form.broker_contracts, c.id] : form.broker_contracts.filter(id => id !== c.id) })}/> {c.number}</label>)}</fieldset></>}
   <div className="flex gap-4 sm:col-span-2"><button className="portal-button" disabled={busy}>{form.user_id ? t('حفظ التعديلات', 'Save changes') : t('إنشاء الحساب', 'Create account')}</button><button type="button" onClick={() => setForm(null)}>{t('إلغاء', 'Cancel')}</button></div>
  </form>}
  <section className="space-y-3">{!data && <p>{t('جارٍ تحميل المستخدمين…', 'Loading users…')}</p>}{data?.users.map(user => <article key={user.id} className="portal-card"><div className="flex flex-wrap gap-3 items-center"><div className="flex-1"><h2 className="font-bold">{user.full_name} · {en ? user.role : roleLabels[user.role]}</h2><p dir="ltr" className="text-start">{user.email} · {user.mobile}</p><p>{user.is_active ? t('نشط', 'Active') : t('معطل', 'Inactive')} · {t('الدعوة', 'Invite')}: {user.invitation_status}</p><p>{t('آخر دخول', 'Last login')}: {user.last_login ? new Date(user.last_login).toLocaleString(en ? 'en-GB' : 'ar-SA', { calendar: 'gregory' }) : t('لم يسجل الدخول بعد', 'Never signed in')}</p></div><div className="flex flex-wrap gap-3">{['BROKER', 'OWNER', 'TENANT', 'EMPLOYEE'].includes(user.role) && <button disabled={busy} onClick={() => edit(user)}>{t('تعديل الروابط', 'Edit links')}</button>}{(['invite', 'reset', user.is_active ? 'deactivate' : 'activate'] as const).map(action => <button key={action} disabled={busy} onClick={() => void run(`/api/access/users/${user.id}`, { action })}>{action === 'invite' ? t('إعادة الدعوة', 'Resend invite') : action === 'reset' ? t('إعادة كلمة المرور', 'Reset password') : action === 'activate' ? t('تفعيل', 'Activate') : t('تعطيل', 'Deactivate')}</button>)}</div></div></article>)}</section>
  {data && <section className="portal-card"><h2 className="font-bold">{t('عند انتهاء الإيجار', 'When the lease ends')}</h2><select className="portal-input" disabled={busy} value={data.settings.tenant_lease_end_action} onChange={e => void run('/api/access/settings', { tenant_lease_end_action: e.target.value })}><option value="HISTORY">{t('عرض السجل فقط', 'Read-only history')}</option><option value="DEACTIVATE">{t('إيقاف الدخول', 'Disable access')}</option></select></section>}
  <section className="portal-card"><h2 className="font-bold mb-4">{t('سجل تدقيق الصلاحيات', 'Access audit log')}</h2>{data?.audit.map(event => <div key={event.id} className="py-3 border-b border-[#BFD9C6]"><p>{event.action} · {new Date(event.created_at).toLocaleString(en ? 'en-GB' : 'ar-SA', { calendar: 'gregory' })}</p><p className="text-sm">{t('بواسطة', 'By')}: {data.users.find(u => u.id === event.actor_user_id)?.full_name || event.actor_user_id} → {data.users.find(u => u.id === event.target_user_id)?.full_name || '—'}</p></div>)}</section>
 </div>;
}
