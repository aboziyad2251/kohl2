import { NextRequest } from 'next/server';
import { apiError, json, PortalError } from '@/lib/portal/server';
import { requireInternal } from '@/lib/navigation/require-internal';
import { workflow } from '@/lib/portal/workflow-server';
import type { PortalDashboard } from '@/lib/portal/workflows';
import type { CalendarEvent } from '@/lib/navigation/workspace';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { client, profile, user } = await requireInternal(req);
    const month = req.nextUrl.searchParams.get('month') || '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 2000 || Number(month.slice(0, 4)) > 2100) throw new PortalError(400, 'Invalid calendar month');
    const start = `${month}-01`, end = `${month}-31`;
    // Actual last day is required for Postgres date columns, including February.
    const [year, index] = month.split('-').map(Number);
    const last = `${month}-${new Date(Date.UTC(year, index, 0)).getUTCDate()}`;
    const role = profile.account.role, executive = ['ADMIN', 'CEO'].includes(role);
    const events: CalendarEvent[] = [], warnings: string[] = [];
    const within = (day: string) => day >= start && day <= end;
    // User-token client preserves existing database RLS. No service-role reads here.
    const jobs: Promise<void>[] = [];
    const addQuery = (label: string, query: PromiseLike<{ data: any[] | null; error: unknown }>, map: (row: any) => CalendarEvent) => {
      jobs.push((async () => {
        try {
          const { data, error } = await query;
          if (error) throw error;
          if ((data?.length || 0) > 500) warnings.push(`${label}: يعرض أول 500 سجل فقط.`);
          events.push(...(data || []).slice(0, 500).map(map));
        } catch { warnings.push(`تعذر تحميل ${label}. أعد المحاولة.`); }
      })());
    };
    addQuery('الإجازات', client.from('leave_requests').select('id,employee_name,start_date,status').gte('start_date', start).lte('start_date', last).neq('status', 'REJECTED').order('start_date').order('id').limit(501), row => ({ id: `leave:${row.id}`, source: 'leave', date: row.start_date, title: `إجازة · ${row.employee_name}`, href: '/employees?tab=leaves', status: row.status }));
    if (executive || role === 'EMPLOYEE') {
      addQuery('أجندة KR', client.from('kr_agenda_tasks').select('id,action,due_date,due_at,status').eq('is_current',true).gte('due_date', start).lte('due_date', last).order('due_at').order('id').limit(501), row => ({ id: `agenda:${row.id}`, source: 'agenda', date: row.due_date, scheduledAt: row.due_at, title: row.action, href: `/today?date=${row.due_date}`, status: row.status }));
      addQuery('متابعات العملاء', client.from('crm_activities').select('id,title,due_date,status').gte('due_date', start).lte('due_date', last).order('due_date').order('id').limit(501), row => ({ id: `crm:${row.id}`, source: 'crm', date: row.due_date, title: row.title, href: '/crm?tab=activities', status: row.status }));
      addQuery('الصفقات', client.from('crm_deals').select('id,title,expected_closing_date,stage').gte('expected_closing_date', start).lte('expected_closing_date', last).not('stage', 'in', '(WON,LOST)').order('expected_closing_date').order('id').limit(501), row => ({ id: `deal:${row.id}`, source: 'deals', date: row.expected_closing_date, title: row.title, href: '/crm?tab=deals', status: row.stage }));
      addQuery('تجديد العقود', client.from('contracts').select('id,contract_number,end_date,status').gte('end_date', start).lte('end_date', last).in('status', ['Active', 'active', 'ساري']).order('end_date').order('id').limit(501), row => ({ id: `contract:${row.id}`, source: 'contracts', date: row.end_date, title: `نهاية عقد · ${row.contract_number}`, href: '/contracts', status: row.status }));
      addQuery('عقود إدارة الأملاك', client.from('managed_property_contracts').select('id,property_name,end_date,status').gte('end_date', start).lte('end_date', last).in('status', ['Active', 'Under_Renewal']).order('end_date').order('id').limit(501), row => ({ id: `management:${row.id}`, source: 'management', date: row.end_date, title: `نهاية إدارة · ${row.property_name}`, href: '/property-management', status: row.status }));
      addQuery('الوكالات', client.from('e_poas').select('id,poa_number,expiry_date,status').gte('expiry_date', start).lte('expiry_date', last).neq('status', 'Revoked').order('expiry_date').order('id').limit(501), row => ({ id: `poa:${row.id}`, source: 'poas', date: row.expiry_date, title: `انتهاء وكالة · ${row.poa_number}`, href: '/ownership-properties?tab=epoa', status: row.status }));
    }
    if (executive) jobs.push((async () => {
      try {
        const data = await workflow(user.id, 'DASHBOARD') as PortalDashboard;
        for (const task of data.maintenance) {
          if (!task.scheduled_at || !['scheduled', 'in_progress'].includes(task.status)) continue;
          const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(task.scheduled_at));
          const day = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
          if (within(day)) events.push({ id: `portal:${task.id}`, source: 'portal', date: day, scheduledAt: task.scheduled_at, title: `${task.number} · ${task.category}`, href: '/portal-management?tab=maintenance', status: task.status });
        }
        for (const due of data.dues) if (within(due.due_date)) events.push({ id: `due:${due.id}`, source: 'dues', date: due.due_date, title: due.description, href: '/portal-management?tab=payments' });
      } catch { warnings.push('تعذر تحميل مواعيد الصيانة والمستحقات من البوابات.'); }
    })());
    await Promise.all(jobs);
    events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    return json({ events, warnings });
  } catch (error) { return apiError(error); }
}
