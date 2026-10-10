// UI tests use fake sessions and intercept every business API. No production data is read.
const { chromium } = require('playwright');
const fs = require('node:fs'), assert = require('node:assert/strict'), vm = require('node:vm'), ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/portal/attention.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject, Date, Math, Intl, Map });
const base = process.env.ATTENTION_QA_URL || 'http://127.0.0.1:3110';
const id = '00000000-0000-4000-8000-000000000001';
const fixture = { role: 'ADMIN', today: '2026-10-08', properties: [{ id: 'p', name: 'عقار تجريبي', city: 'الرياض', address: 'عنوان تجريبي', units_count: 1 }],
    contracts: [{ id: 'c', number: 'QA-LEASE', property_id: 'p', annual_rent: 12000, start_date: '2026-01-01', end_date: '2026-10-31', status: 'Active', unit_label: 'QA-1' }],
    dues: [{ id: 'd', contract_id: 'c', kind: 'rent', description: 'QA October rent', due_date: '2026-10-01', period_start: '2026-10-01', period_end: '2026-10-31', amount: 1000 }],
    payments: [{ id: 'payment', due_id: 'd', property_id: 'p', contract_id: 'c', flow: 'INCOME', category: 'RENTAL_PAYMENT', date: '2026-10-03', amount: 200 }],
    maintenance: [{ id: 'm', number: 'QA-TASK', property_id: 'p', contract_id: 'c', category: 'QA Plumbing', description: 'Fake QA request', status: 'awaiting_customer_approval', cost: 250, cost_bearer: 'tenant', cost_customer_id: id, requested_by: id, created_at: '2026-10-01T10:00:00Z', history: [], attachments: [] }],
    commissions: [{ contract_id: 'c', broker_user_id: id, number: 'QA-LEASE', status: 'approved', closed_at: '2026-10-01T10:00:00Z', amount: 600, contract_value: 12000, type: 'FIXED', rate: 600 }],
    kpis: [], ownership: [], customers: [], audit: [] };
async function prepare(browser, role, { empty = false, fail = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const jwt = [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: id })).toString('base64url'), 'fake-signature'].join('.');
    await context.addInitScript(({ id, jwt }) => {
        const session = { access_token: jwt, refresh_token: 'fake-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email: 'qa@test.invalid', user_metadata: {} } };
        ['sb-51-auth-token', 'sb-kohl-auth-token'].forEach(key => localStorage.setItem(key, JSON.stringify(session)));
    }, { id, jwt });
    const data = { ...fixture, role };
    if (role === 'BROKER') { data.dues = []; data.payments = []; data.properties = []; data.maintenance = []; }
    if (empty) for (const key of ['properties', 'contracts', 'dues', 'payments', 'maintenance', 'commissions']) data[key] = [];
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/api/portal/me') return json({ account: { id, name: 'مستخدم تجريبي', role, history_only: false, phone: '0500000000' }, owners: [], leases: [], broker_contracts: [], email: 'qa@test.invalid' });
        if (url.pathname === '/api/portal/attention') return fail ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Unavailable"}' }) : json(exportsObject.attentionSummary(data, id));
        if (url.pathname === '/api/portal/dashboard') return json(data);
        if (url.pathname.startsWith('/rest/v1/')) return json([]);
        if (url.pathname.startsWith('/auth/v1/')) return json({ id, email: 'qa@test.invalid' });
        if (url.origin !== new URL(base).origin) return route.abort();
        if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/')) throw new Error('Unexpected business API in UI test: ' + url.pathname);
        return route.continue();
    });
    return context;
}
(async () => {
    const browser = await chromium.launch({ headless: true, channel: process.env.ATTENTION_QA_CHANNEL || 'msedge' });
    fs.mkdirSync('.portal-stage', { recursive: true });
    try {
        for (const role of ['ADMIN', 'CEO', 'TENANT', 'OWNER', 'BROKER']) {
            const context = await prepare(browser, role), page = await context.newPage();
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            await page.goto(base + (['ADMIN', 'CEO'].includes(role) ? '/dashboard' : '/portal'));
            await page.getByRole('heading', { name: 'تنبيهات ومهام تحتاج متابعة', exact: true }).waitFor();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, role + ' horizontal overflow');
            await page.screenshot({ path: '.portal-stage/attention-' + role + '.png', fullPage: true });
            if (['ADMIN', 'CEO'].includes(role)) {
                await page.getByRole('link', { name: /^التنبيهات:/ }).waitFor();
                await page.locator('#attention').getByRole('button', { name: 'الدفعات', exact: true }).click();
                await page.locator('#attention').getByRole('link', { name: 'فتح القسم' }).click();
                await page.getByRole('heading', { name: 'المستحقات والفواتير', exact: true }).waitFor();
                assert.ok(page.url().includes('tab=payments'), 'Notification opens the requested section');
            } else {
                await page.getByRole('button', { name: 'English', exact: true }).click();
                await page.getByRole('heading', { name: 'Alerts & actions', exact: true }).waitFor();
                if (role === 'TENANT') {
                    await page.getByText('Maintenance quote needs your approval', { exact: true }).waitFor();
                    await page.locator('#attention').getByRole('button', { name: 'Maintenance', exact: true }).click();
                    await page.locator('#attention').getByRole('button', { name: 'Open section', exact: true }).click();
                    await page.getByRole('heading', { name: 'New maintenance request', exact: true }).waitFor();
                }
                if (role === 'BROKER') assert.equal(await page.getByText('Overdue obligation', { exact: true }).count(), 0);
            }
            assert.deepEqual(errors, [], role + ' client errors');
            await context.close(); console.log(role + ': responsive alerts, role presentation and action navigation passed');
        }
        for (const mode of [{ empty: true }, { fail: true }]) {
            const context = await prepare(browser, 'ADMIN', mode), page = await context.newPage();
            await page.goto(base + '/dashboard');
            if (mode.empty) await page.getByText('لا توجد تنبيهات ضمن هذه الفئة حالياً.', { exact: true }).waitFor();
            else { await page.getByRole('alert').waitFor(); assert.equal(await page.getByText('لا توجد تنبيهات ضمن هذه الفئة حالياً.', { exact: true }).count(), 0); }
            await context.close();
        }
        const context = await browser.newContext({ viewport: { width: 390, height: 900 } }), page = await context.newPage();
        await page.goto(base + '/login'); await page.getByRole('link', { name: 'نسيت كلمة المرور؟' }).click();
        await page.getByRole('button', { name: 'English', exact: true }).click();
        await page.getByText(/Email password recovery is currently unavailable/).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Send recovery link' }).count(), 0);
        await page.getByRole('link', { name: 'Back to login', exact: true }).click();
        assert.ok(page.url().endsWith('/login')); await context.close();
        console.log('Empty/error states and SMTP-disabled recovery guidance passed');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
