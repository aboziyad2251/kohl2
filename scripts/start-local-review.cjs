// Interactive review uses isolated browser contexts and synthetic fixture APIs.
const fs = require('node:fs');
const { chromium } = require(process.env.KOHL_PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.KOHL_TEST_ORIGIN || 'http://127.0.0.1:3123';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Local review requires loopback');
const workspace = fs.readFileSync('tests/workspace-browser.cjs', 'utf8').split('(async()=>{')[0];
const { contextFor } = new Function('require', 'process', workspace + ';return {contextFor};')(require, { env: { KOHL_TEST_ORIGIN: origin } });
const portal = fs.readFileSync('scripts/test-attention-browser.cjs', 'utf8').split('(async () => {')[0];
const { prepare, fixture } = new Function('require', 'process', portal + ';return {prepare,fixture};')(require, { env: { ATTENTION_QA_URL: origin } });
const { install } = require('./payout-review-fixture.cjs');
fixture.contracts[0].id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
fixture.commissions[0].contract_id=fixture.contracts[0].id;
async function readOnly(context) {
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      return route.fulfill({ status: 403, json: { error: 'معاينة محلية للعرض فقط — لم يتم حفظ أو إرسال أي شيء.' } });
    }
    if (url.origin === origin && url.pathname === '/api/financials/kr') {
      return route.fulfill({ json: { report: null, recent: [], schedule: { enabled: false, report_time: '18:00', timezone: 'Asia/Riyadh' }, can_edit: false } });
    }
    return route.fallback();
  });
}
async function label(page, role) {
  await page.evaluate(role => {
    const banner = document.createElement('div');
    banner.textContent = `معاينة محلية · ${role} · بيانات وهمية · طلبات الصرف تجريبية`;
    banner.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:999999;padding:8px 14px;border-radius:12px;background:#fef3c7;color:#78350f;font:13px sans-serif;box-shadow:0 2px 12px #0003;pointer-events:none';
    document.body.appendChild(banner);
  }, role);
}
(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: process.env.KOHL_CHROMIUM_PATH, args: ['--start-maximized'] });
  const store={requests:[]};
  const admin = await contextFor(browser, 'ADMIN', 1440); await readOnly(admin);
  await install(admin,{role:'ADMIN',store});
  const adminPage = await admin.newPage(); await adminPage.goto(origin + '/portal-management?tab=broker');
  await adminPage.locator('.kohl-workspace').waitFor(); await label(adminPage, 'المدير');
  const broker = await prepare(browser, 'BROKER'); await readOnly(broker);
  await install(broker,{role:'BROKER',store,commissions:fixture.commissions});
  const brokerPage = await broker.newPage(); await brokerPage.setViewportSize({ width: 1440, height: 950 }); await brokerPage.goto(origin + '/portal');
  await brokerPage.locator('.broker-welcome').waitFor(); await label(brokerPage, 'الوسيط');
  await adminPage.bringToFront();
  console.log('LOCAL_REVIEW_READY: manager approval and broker requests; shared in-memory payout simulation, no database');
  await new Promise(resolve => browser.on('disconnected', resolve));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
