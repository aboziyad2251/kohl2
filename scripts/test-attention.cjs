const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const result = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/portal/attention.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: result, Date, Math, Intl, Map });
const { attentionSummary } = result;
const base = { role: 'ADMIN', today: '2026-10-08', properties: [], contracts: [], dues: [], payments: [], maintenance: [], commissions: [], kpis: [], ownership: [], customers: [], audit: [] };
const contract = { id: 'c', number: 'C-001', status: 'Active', start_date: '2026-01-01', end_date: '2026-11-07' };
const data = { ...base, contracts: [contract, { ...contract, id: 'past', end_date: '2026-10-07' }, { ...contract, id: 'inactive', status: 'Cancelled' }, { ...contract, id: 'future', start_date: '2026-11-01' }, { ...contract, id: 'later', end_date: '2026-11-08' }],
    dues: [{ id: 'partial', contract_id: 'c', kind: 'rent', amount: 100.03, due_date: '2026-10-07', description: 'Rent' }, { id: 'paid', kind: 'rent', amount: 50, due_date: '2026-10-01' }, { id: 'utility', kind: 'utility', amount: 40, due_date: '2026-10-01' }, { id: 'today', kind: 'rent', amount: 10, due_date: '2026-10-08' }, { id: 'boundary', kind: 'rent', amount: 10, due_date: '2026-10-15' }, { id: 'later', kind: 'rent', amount: 20, due_date: '2026-10-16' }],
    payments: [{ due_id: 'partial', flow: 'INCOME', amount: 33.01 }, { due_id: 'partial', flow: 'INCOME', amount: 33.01 }, { due_id: 'partial', flow: 'EXPENSE', amount: 9 }, { due_id: 'paid', flow: 'INCOME', amount: 60 }, { flow: 'INCOME', amount: 999 }],
    maintenance: ['pending', 'awaiting_manager_approval', 'awaiting_customer_approval', 'completed', 'cancelled'].map((status, i) => ({ id: 'm' + i, number: 'M' + i, category: 'Plumbing', status, created_at: '2026-10-01T10:00:00Z', contract_id: 'c', cost_customer_id: 'tenant', cost_bearer: 'tenant' })),
    commissions: [{ broker_user_id: 'b', contract_id: 'c', number: 'C-001', closed_at: '2026-10-07T21:30:00Z', status: 'approved', amount: 25.01 }, { broker_user_id: 'b', contract_id: 'x', status: 'pending', amount: 100 }, { broker_user_id: 'b', contract_id: 'future', closed_at: '2026-10-08T21:30:00Z', status: 'pending', amount: 100 }, { broker_user_id: 'b', contract_id: 'paid', closed_at: '2026-10-01T12:00:00Z', status: 'paid', amount: 200 }] };
const admin = attentionSummary(data, 'admin');
assert.equal(admin.metrics.overdueRent, 34.01, 'Only linked income reduces rent arrears, with cents arithmetic');
assert.equal(admin.metrics.overdueCount, 1, 'Utility arrears are not rent arrears');
assert.equal(admin.metrics.expiringContracts, 1, 'Only currently active leases through the inclusive 30-day boundary');
assert.equal(admin.metrics.approvals, 1, 'Executives approve manager decisions, not customer decisions');
assert.equal(admin.metrics.openMaintenance, 3);
assert.equal(admin.metrics.unpaidCommission, 25.01, 'Only closed, unpaid deals through Riyadh today');
assert.equal(admin.items.find(i => i.id === 'due:partial').amount, 34.01);
assert.equal(admin.items.find(i => i.id === 'due:today').kind, 'due_soon');
assert.ok(admin.items.some(i => i.id === 'due:boundary'));
assert.ok(!admin.items.some(i => ['due:paid', 'due:later', 'maintenance:m2'].includes(i.id)));
assert.equal(admin.items[0].kind, 'overdue');
const tenant = attentionSummary({ ...data, role: 'TENANT', commissions: [] }, 'tenant');
assert.equal(tenant.metrics.approvals, 1);
assert.ok(tenant.items.some(i => i.id === 'maintenance:m2'));
assert.ok(!tenant.items.some(i => i.id === 'maintenance:m1' || i.id === 'maintenance:m0'));
assert.equal(attentionSummary({ ...data, role: 'TENANT' }, 'other-user').metrics.approvals, 0, 'Only the designated customer can approve');
assert.equal(attentionSummary({ ...data, role: 'TENANT', contracts: [{ ...contract, end_date: '2026-10-07' }] }, 'tenant').metrics.approvals, 0, 'Expired tenants cannot act');
assert.equal(attentionSummary({ ...data, role: 'OWNER' }, 'tenant').metrics.approvals, 0, 'Owner cannot approve a tenant-borne quote');
const visit = attentionSummary({ ...base, maintenance: [{ id: 'visit', number: 'M', category: 'Visit', status: 'scheduled', scheduled_at: '2026-10-15T21:00:00Z', created_at: '2026-10-01' }] }, 'admin');
assert.equal(visit.items.length, 0, 'UTC late evening belongs to the following Riyadh day');
assert.equal(attentionSummary(base, 'admin').items.length, 0);
console.log('Action-center checks passed: cents, linked payments, role-specific approval, expiry, windows, Riyadh dates and closed commissions.');
