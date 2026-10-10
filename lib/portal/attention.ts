import type { PortalDashboard } from './workflows';

export type AttentionTab = 'payments' | 'maintenance' | 'broker' | 'overview';
export interface AttentionItem {
    id: string;
    kind: 'overdue' | 'due_soon' | 'renewal' | 'approval' | 'maintenance' | 'commission';
    priority: number;
    title: { ar: string; en: string };
    detail: { ar: string; en: string };
    tab: AttentionTab;
    date: string;
    amount?: number;
}
export interface AttentionSummary {
    today: string;
    items: AttentionItem[];
    metrics: { overdueRent: number; overdueCount: number; expiringContracts: number; approvals: number; openMaintenance: number; unpaidCommission: number };
}
const active = (status: string) => ['active', 'ساري'].includes(status.toLowerCase());
const addDays = (date: string, days: number) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const cents = (amount: number) => Math.round(Number(amount) * 100);
const localDay = (time: string) => {
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
};

/** Input comes exclusively from the existing private-profile scoped DASHBOARD RPC. */
export function attentionSummary(data: PortalDashboard, userId: string): AttentionSummary {
    const executive = ['ADMIN', 'CEO'].includes(data.role);
    const items: AttentionItem[] = [];
    const metrics = { overdueRent: 0, overdueCount: 0, expiringContracts: 0, approvals: 0, openMaintenance: 0, unpaidCommission: 0 };
    const paid = new Map<string, number>();
    for (const payment of data.payments) {
        if (payment.due_id && payment.flow === 'INCOME') paid.set(payment.due_id, (paid.get(payment.due_id) || 0) + cents(payment.amount));
    }
    for (const due of data.dues) {
        const outstanding = Math.max(0, cents(due.amount) - (paid.get(due.id) || 0)) / 100;
        if (!outstanding || due.due_date > addDays(data.today, 7)) continue;
        const overdue = due.due_date < data.today;
        const contract = data.contracts.find(c => c.id === due.contract_id);
        if (overdue && due.kind === 'rent') { metrics.overdueRent += cents(outstanding); metrics.overdueCount++; }
        items.push({ id: 'due:' + due.id, kind: overdue ? 'overdue' : 'due_soon', priority: overdue ? 0 : 2, tab: 'payments', date: due.due_date, amount: outstanding,
            title: { ar: overdue ? 'مستحق متأخر' : 'دفعة خلال 7 أيام', en: overdue ? 'Overdue obligation' : 'Payment due within 7 days' },
            detail: { ar: `${contract?.number || ''} · ${due.description}`, en: `${contract?.number || ''} · ${due.description}` } });
    }
    metrics.overdueRent /= 100;
    for (const contract of data.contracts) {
        if (!active(contract.status) || contract.start_date > data.today || contract.end_date < data.today || contract.end_date > addDays(data.today, 30)) continue;
        metrics.expiringContracts++;
        items.push({ id: 'renewal:' + contract.id, kind: 'renewal', priority: 2, tab: 'overview', date: contract.end_date,
            title: { ar: 'عقد ينتهي خلال 30 يوماً', en: 'Contract expires within 30 days' },
            detail: { ar: contract.number, en: contract.number } });
    }
    for (const task of data.maintenance) {
        if (['completed', 'closed', 'rejected', 'cancelled'].includes(task.status)) continue;
        metrics.openMaintenance++;
        const contract = data.contracts.find(c => c.id === task.contract_id);
        const tenantCanAct = data.role !== 'TENANT' || !!contract && active(contract.status) && contract.start_date <= data.today && contract.end_date >= data.today;
        const customerApproval = tenantCanAct && task.status === 'awaiting_customer_approval' && task.cost_customer_id === userId &&
            ((data.role === 'TENANT' && task.cost_bearer === 'tenant') || (data.role === 'OWNER' && task.cost_bearer === 'owner'));
        const managerApproval = executive && task.status === 'awaiting_manager_approval';
        const review = executive && ['pending', 'under_review'].includes(task.status);
        const visit = ['scheduled', 'in_progress'].includes(task.status) && !!task.scheduled_at && localDay(task.scheduled_at) <= addDays(data.today, 7);
        if (!customerApproval && !managerApproval && !review && !visit) continue;
        if (customerApproval || managerApproval) metrics.approvals++;
        items.push({ id: 'maintenance:' + task.id, kind: customerApproval || managerApproval ? 'approval' : 'maintenance', priority: customerApproval || managerApproval ? 1 : 3, tab: 'maintenance', date: visit ? localDay(task.scheduled_at!) : task.created_at.slice(0, 10),
            title: { ar: customerApproval ? 'عرض صيانة بانتظار موافقتك' : managerApproval ? 'صيانة بانتظار اعتماد الإدارة' : review ? 'طلب صيانة يحتاج مراجعة' : 'موعد صيانة يحتاج متابعة',
                en: customerApproval ? 'Maintenance quote needs your approval' : managerApproval ? 'Maintenance needs manager approval' : review ? 'Maintenance request needs review' : 'Maintenance visit needs follow-up' },
            detail: { ar: `${task.number} · ${task.category}`, en: `${task.number} · ${task.category}` } });
    }
    if (executive || data.role === 'BROKER') for (const commission of data.commissions) {
        if (!commission.closed_at || localDay(commission.closed_at) > data.today || !['pending', 'approved'].includes(commission.status)) continue;
        metrics.unpaidCommission += cents(commission.amount);
        items.push({ id: `commission:${commission.broker_user_id}:${commission.contract_id}`, kind: 'commission', priority: 3, tab: 'broker', date: localDay(commission.closed_at), amount: commission.amount,
            title: { ar: commission.status === 'pending' ? 'عمولة بانتظار الاعتماد' : 'عمولة معتمدة بانتظار الصرف', en: commission.status === 'pending' ? 'Commission awaiting approval' : 'Approved commission awaiting payment' },
            detail: { ar: commission.number, en: commission.number } });
    }
    metrics.unpaidCommission /= 100;
    items.sort((a, b) => a.priority - b.priority || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    return { today: data.today, items, metrics };
}
