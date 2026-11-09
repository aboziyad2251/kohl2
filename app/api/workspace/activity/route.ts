import { NextRequest } from 'next/server';
import { requireIdentity, administrative, apiError, json } from '@/lib/portal/server';
import { workflow } from '@/lib/portal/workflow-server';
import type { PortalDashboard } from '@/lib/portal/workflows';
import type { AccessData } from '@/lib/portal/types';
import type { ActivityEvent } from '@/lib/navigation/workspace';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const { client, user } = await requireIdentity(req, true);
    const events: ActivityEvent[] = [], warnings: string[] = [];
    await Promise.all([
      (async () => {
        try {
          const { data, error } = await client.from('ownership_audit_logs').select('id,change_type,created_at').order('created_at', { ascending: false }).order('id').limit(100);
          if (error) throw error;
          events.push(...(data || []).map(row => ({ id: `ownership:${row.id}`, source: 'ownership' as const, date: row.created_at, action: row.change_type === 'LESSOR_TRANSFER' ? 'نقل ملكية / تغيير المؤجر' : row.change_type === 'REPRESENTATIVE_CHANGE' ? 'تغيير الممثل' : row.change_type, actor: 'غير مسجل في هذا المصدر', href: '/ownership-properties?tab=audit' })));
        } catch { warnings.push('تعذر تحميل سجل تغييرات الملكية.'); }
      })(),
      (async () => {
        try {
          const data = await workflow(user.id, 'DASHBOARD') as PortalDashboard;
          events.push(...data.audit.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100).map(row => ({ id: `portal:${row.id}`, source: 'portal' as const, date: row.created_at, action: `${row.resource} · ${row.action}`, actor: row.actor_name || 'مستخدم مسجل', href: '/portal-management?tab=audit' })));
        } catch { warnings.push('تعذر تحميل سجل البوابات.'); }
      })(),
      (async () => {
        try {
          const data = await administrative(user.id, 'LIST') as AccessData;
          events.push(...data.audit.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100).map(row => ({ id: `access:${row.id}`, source: 'access' as const, date: row.created_at, action: row.action, actor: data.users.find(user => user.id === row.actor_user_id)?.full_name || 'مستخدم مسجل', href: '/users-access' })));
        } catch { warnings.push('تعذر تحميل سجل تدقيق الصلاحيات.'); }
      })(),
    ]);
    // IDs are namespaced. Separate audit streams remain separate; never infer that
    // two entries describe the same action or expose before/after customer data.
    events.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    return json({ events, warnings });
  } catch (error) { return apiError(error); }
}
