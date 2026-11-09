export const calendarSources = {
  agenda: 'أجندة KR المعتمدة', crm: 'متابعات العملاء', deals: 'الصفقات', contracts: 'تجديد العقود',
  management: 'عقود إدارة الأملاك', poas: 'الوكالات', leave: 'الإجازات',
  portal: 'مواعيد صيانة البوابات', dues: 'المستحقات',
} as const;
export interface CalendarEvent { id: string; source: keyof typeof calendarSources; date: string; title: string; href: string; status?: string; scheduledAt?: string; }
export interface CalendarData { events: CalendarEvent[]; warnings: string[]; }
export function availableCalendarSources(role: string): (keyof typeof calendarSources)[] {
  if (role === 'HR') return ['leave'];
  if (role === 'EMPLOYEE') return ['agenda', 'crm', 'deals', 'contracts', 'management', 'poas', 'leave'];
  if (role === 'ADMIN' || role === 'CEO') return Object.keys(calendarSources) as (keyof typeof calendarSources)[];
  return [];
}
export function calendarStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    PENDING: 'بانتظار المتابعة', COMPLETED: 'مكتمل', APPROVED: 'معتمد',
    NEW: 'جديد', CONTACTED: 'تم التواصل', SHOWING: 'معاينة', NEGOTIATION: 'تفاوض',
    Active: 'ساري', active: 'ساري', 'ساري': 'ساري', Under_Renewal: 'قيد التجديد',
    Expired: 'منتهي', scheduled: 'مجدول', in_progress: 'قيد التنفيذ',
  };
  return status ? labels[status] || '' : '';
}
export interface ActivityEvent { id: string; source: 'ownership' | 'portal' | 'access'; date: string; action: string; actor: string; href: string; }
export interface ActivityData { events: ActivityEvent[]; warnings: string[]; }
export const activitySources = { ownership: 'تغييرات الملكية', portal: 'سجل البوابات', access: 'تدقيق الصلاحيات' };
export interface WorkspaceStatus {
  checkedAt: string;
  database: boolean;
  hatif: { enabled: boolean; configured: boolean; lastRecordedActivity: string | null; observationAvailable: boolean };
  aiConfigured: boolean;
  googleEnabled: boolean;
  recoveryEnabled: boolean;
}
export function riyadhDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function monthRange(month: string) {
  const [year, index] = month.split('-').map(Number);
  return { start: `${month}-01`, end: `${month}-${new Date(Date.UTC(year, index, 0)).getUTCDate()}` };
}
export function shiftMonth(month: string, offset: number) {
  const [year, index] = month.split('-').map(Number);
  return new Date(Date.UTC(year, index - 1 + offset, 1)).toISOString().slice(0, 7);
}
