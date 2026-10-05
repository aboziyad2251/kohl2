const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/portal/calculations.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, Date, Math });
const { ownerEarnings, periodRange, dueStatus, brokerPerformance, kpiPerformance } = exportsObject;
const data = { role: 'OWNER', today: '2026-10-05', properties: [{ id: 'p', name: 'Property' }], contracts: [{ id: 'c', property_id: 'p' }], ownership: [{ property_id: 'p', ownership_share: 25, effective_from: '2026-01-01' }], payments: [
    { id: 'r1', property_id: 'p', amount: 1000.12, flow: 'INCOME', category: 'RENTAL_PAYMENT', date: '2026-10-01', due_id: 'd' },
    { id: 'fee', property_id: 'p', amount: 100, flow: 'INCOME', category: 'MANAGEMENT_FEE', date: '2026-10-01', owner_charge: true },
    { id: 'expense', property_id: 'p', amount: 50, net_amount: 57.5, flow: 'EXPENSE', category: 'OPERATING_EXPENSE', date: '2026-10-02', owner_charge: true },
    { id: 'prior', property_id: 'p', amount: 2000, flow: 'INCOME', category: 'RENTAL_PAYMENT', date: '2026-08-01' },
], dues: [{ id: 'd', kind: 'rent', contract_id: 'c', due_date: '2026-10-01', amount: 1200 }], maintenance: [{ id: 'm', property_id: 'p', cost_bearer: 'owner', status: 'completed', cost: 200, completed_at: '2026-10-03' }] };
const monthly = ownerEarnings(data, '2026-10-01', '2026-10-31')[0];
assert.equal(monthly.gross, 1000.12); assert.equal(monthly.deductions, 357.5); assert.equal(monthly.net, 642.62); assert.equal(monthly.expected, 1200);
assert.equal(ownerEarnings(data, '2026-01-01', '2026-12-31')[0].gross, 3000.12);
assert.equal(ownerEarnings(data, '2026-10-01', '2026-12-31')[0].gross, monthly.gross);
assert.equal(periodRange('2024-02-15', 'monthly').end, '2024-02-29');
assert.equal(periodRange('2026-11-15', 'quarterly').start, '2026-10-01');
assert.equal(periodRange('2026-11-15', 'yearly').end, '2026-12-31');
assert.equal(dueStatus(data, 'd').status, 'overdue'); assert.equal(dueStatus(data, 'd').outstanding, 199.88);
const closed = [{ broker_user_id: 'b', closed_at: '2026-10-01', amount: 200, contract_value: 10000 }, { broker_user_id: 'b', closed_at: '2026-09-01', amount: 300, contract_value: 20000 }];
assert.equal(brokerPerformance(closed, '2026-10-01', '2026-10-31').commission, 200);
assert.equal(kpiPerformance({ broker_user_id: 'b', metric: 'contract_count', period_start: '2026-10-01', period_end: '2026-10-31', target: 2 }, closed, '2026-10-05').status, 'on_track');
assert.equal(kpiPerformance({ broker_user_id: 'b', metric: 'commission', period_start: '2026-10-01', period_end: '2026-10-31', target: 200 }, closed, '2026-10-05').status, 'achieved');
console.log('Portal calculation checks passed: full property totals, fees/expenses/maintenance, all period frequencies, leap year, outstanding payments, KPI and monthly broker totals');
