import type { BrokerageAgreement, Contract, EPoa } from '@/lib/types';
import { riyadhDay } from '@/lib/navigation/workspace';

export function ejarLink(record: { ejar_contract_number?: string | null; ejar_sync_status?: string | null; ejar_status?: string }) {
  if (record.ejar_status === 'Cancelled') return 'UNLINKED';
  const number = record.ejar_contract_number?.trim();
  const status = record.ejar_sync_status || record.ejar_status;
  if (number && /^[A-Za-z0-9\u0600-\u06ff/_-]{3,100}$/.test(number) && ['LINKED', 'Active'].includes(status || '')) return 'LINKED';
  if (['PENDING', 'Pending'].includes(status || '') || (status === 'UNLINKED' && record.ejar_status === 'Pending')) return 'PENDING';
  return 'UNLINKED';
}
export function documentationMetrics(contracts: Contract[]) {
  const eligible = contracts.filter(c => !c.is_archived && ['Active', 'Expired'].includes(c.status));
  const documented = eligible.filter(c => ejarLink(c) === 'LINKED').length;
  return { total: eligible.length, documented, percentage: eligible.length ? Math.round(documented / eligible.length * 100) : 0 };
}
export function agencyMetrics(agencies: EPoa[], now = new Date()) {
  const today = riyadhDay(now);
  const soon = riyadhDay(new Date(now.getTime() + 30 * 86400000));
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value + 'T00:00:00+03:00')) && riyadhDay(new Date(value + 'T12:00:00+03:00')) === value;
  const expired = agencies.filter(a => a.status === 'Expired' || (a.status !== 'Revoked' && validDate(a.expiry_date) && a.expiry_date < today)).length;
  const active = agencies.filter(a => a.status === 'Active' && validDate(a.expiry_date) && a.expiry_date >= today);
  const expiring = active.filter(a => a.expiry_date <= soon).length;
  const allValid = agencies.length > 0 && active.length === agencies.length && expired === 0 && expiring === 0;
  const message = !active.length ? 'لا توجد وكالات نشطة' : expired || expiring ? `${expired} منتهية · ${expiring} تنتهي خلال 30 يوماً` : allValid ? 'جميع الوكالات سارية' : `${active.length} وكالات نشطة · راجع بقية السجلات`;
  return { active: active.length, expired, expiring, message, tone: allValid ? 'green' : 'amber' };
}
export function brokerageLinkMetrics(agreements: BrokerageAgreement[]) {
  const rows = agreements.filter(a => !a.is_archived);
  const linked = rows.filter(a => ejarLink(a) === 'LINKED').length;
  const pending = rows.filter(a => ejarLink(a) === 'PENDING').length;
  const state = rows.length && linked === rows.length ? 'LINKED' : pending || linked ? 'PENDING' : 'UNLINKED';
  return { state, linked, pending, total: rows.length, label: state === 'LINKED' ? 'مرتبط بإيجار' : state === 'PENDING' ? 'بانتظار الربط' : 'غير مرتبط بإيجار' };
}
export type DashboardMetrics = {
  documentation: ReturnType<typeof documentationMetrics>; agencies: ReturnType<typeof agencyMetrics>; ejar: ReturnType<typeof brokerageLinkMetrics>;
  activeContracts: number; totalProperties: number; activeBrokerage: number;
};
