import type { Commission, KPI, PortalDashboard } from './workflows';
const cents = (amount: number) => Math.round(Number(amount) * 100);
const inPeriod = (date: string | undefined, start: string, end: string) => !!date && date.slice(0, 10) >= start && date.slice(0, 10) <= end;
export function periodRange(date: string, frequency: 'monthly' | 'quarterly' | 'yearly') {
    const [year, month] = date.split('-').map(Number);
    const first = frequency === 'yearly' ? 1 : frequency === 'quarterly' ? Math.floor((month - 1) / 3) * 3 + 1 : month;
    const last = first + (frequency === 'yearly' ? 12 : frequency === 'quarterly' ? 3 : 1) - 1;
    return { start: `${year}-${String(first).padStart(2, '0')}-01`, end: new Date(Date.UTC(year, last, 0)).toISOString().slice(0, 10) };
}
export function ownerEarnings(data: PortalDashboard, start: string, end: string) {
    return data.properties.map(property => {
        let gross = 0, deductions = 0, expected = 0;
        for (const payment of data.payments.filter(p => p.property_id === property.id && inPeriod(p.date, start, end))) {
            if (payment.flow === 'INCOME' && payment.category === 'RENTAL_PAYMENT') gross += cents(payment.amount);
            if (payment.owner_charge) deductions += cents(payment.flow === 'EXPENSE' ? payment.net_amount ?? payment.amount : payment.amount);
        }
        for (const task of data.maintenance.filter(m => m.property_id === property.id && m.cost_bearer === 'owner' && ['completed', 'closed'].includes(m.status) && inPeriod(m.completed_at, start, end))) {
            if (!data.payments.some(p => p.maintenance_task_id === task.id && p.owner_charge)) deductions += cents(task.cost);
        }
        for (const due of data.dues.filter(d => d.kind === 'rent' && inPeriod(d.due_date, start, end) && data.contracts.some(c => c.id === d.contract_id && c.property_id === property.id))) expected += cents(due.amount);
        return { property_id: property.id, name: property.name, gross: gross / 100, deductions: deductions / 100, net: (gross - deductions) / 100, expected: expected / 100 };
    });
}
export function dueStatus(data: PortalDashboard, id: string) {
    const due = data.dues.find(d => d.id === id)!;
    const received = data.payments.filter(p => p.due_id === id && p.flow === 'INCOME').reduce((sum, p) => sum + cents(p.amount), 0);
    return { received: received / 100, outstanding: Math.max(0, cents(due.amount) - received) / 100, status: received >= cents(due.amount) ? 'paid' : due.due_date < data.today ? 'overdue' : 'due' };
}
export function brokerPerformance(commissions: Commission[], start: string, end: string) {
    const closed = commissions.filter(c => inPeriod(c.closed_at, start, end));
    return { count: closed.length, value: closed.reduce((n, c) => n + cents(c.contract_value), 0) / 100, commission: closed.reduce((n, c) => n + cents(c.amount), 0) / 100 };
}
export function kpiPerformance(kpi: KPI, commissions: Commission[], today: string) {
    const performance = brokerPerformance(commissions.filter(c => c.broker_user_id === kpi.broker_user_id), kpi.period_start, kpi.period_end);
    const actual = kpi.metric === 'contract_count' ? performance.count : kpi.metric === 'contract_value' ? performance.value : kpi.metric === 'commission' ? performance.commission : Number(kpi.custom_actual);
    const elapsed = Math.max(0, Math.min(1, (Date.parse(today) - Date.parse(kpi.period_start) + 86400000) / (Date.parse(kpi.period_end) - Date.parse(kpi.period_start) + 86400000)));
    return { actual, status: actual >= kpi.target ? 'achieved' : actual >= kpi.target * elapsed ? 'on_track' : 'below_target' };
}
