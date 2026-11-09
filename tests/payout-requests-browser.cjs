// UI workflow only: shared in-memory RPC fixture. Does not verify SQL or RLS.
const fs=require('fs'),assert=require('assert/strict'),{chromium}=require('playwright'),{install}=require('../scripts/payout-review-fixture.cjs');
const origin=process.env.KOHL_TEST_ORIGIN||'http://127.0.0.1:3123';
const helper=fs.readFileSync('scripts/test-attention-browser.cjs','utf8').split('(async () => {')[0];
const {prepare,fixture}=new Function('require','process',helper+';return {prepare,fixture};')(require,{env:{ATTENTION_QA_URL:origin}});
const workspace=fs.readFileSync('tests/workspace-browser.cjs','utf8').split('(async()=>{')[0];
const {contextFor}=new Function('require','process',workspace+';return {contextFor};')(require,{env:{KOHL_TEST_ORIGIN:origin}});
const contract='cccccccc-cccc-4ccc-8ccc-cccccccccccc';fixture.contracts[0].id=contract;fixture.commissions[0].contract_id=contract;
(async()=>{const browser=await chromium.launch({executablePath:process.env.KOHL_CHROMIUM_PATH,headless:true});try{
 const store={requests:[]},broker=await prepare(browser,'BROKER');await install(broker,{role:'BROKER',store,commissions:fixture.commissions});
 const p=await broker.newPage();await p.goto(origin+'/portal');
 await p.getByLabel('العمولة المستحقة',{exact:true}).selectOption(contract);
 await p.getByLabel('ملاحظة الطلب (اختياري)',{exact:true}).fill('مراجعة عمولة تجريبية');
 await p.getByRole('button',{name:'طلب صرف العمولة',exact:true}).click();await p.locator('article strong').filter({hasText:'بانتظار الاعتماد'}).waitFor();
 assert.equal(store.requests.length,1);assert.equal(store.requests[0].amount,600);assert.equal(await p.getByRole('button',{name:'اعتماد الطلب',exact:true}).count(),0);
 const other=await prepare(browser,'BROKER');await install(other,{role:'BROKER',brokerId:'22222222-2222-4222-8222-222222222222',store});const o=await other.newPage();await o.goto(origin+'/portal');await o.getByText('لا توجد طلبات مطابقة.',{exact:true}).waitFor();assert.equal(await o.locator('article').count(),0);
 const admin=await contextFor(browser,'ADMIN',1440);await install(admin,{role:'ADMIN',store});const a=await admin.newPage();await a.goto(origin+'/portal-management');await a.getByRole('button',{name:'العمولات وطلبات الصرف',exact:true}).click();
 await a.getByRole('button',{name:'اعتماد الطلب',exact:true}).waitFor();assert(await a.getByRole('button',{name:'رفض الطلب',exact:true}).isDisabled());
 await a.getByLabel('ملاحظة القرار / سبب الرفض',{exact:true}).fill('راجع المرفقات');await a.getByRole('button',{name:'رفض الطلب',exact:true}).click();await a.locator('article strong').filter({hasText:'مرفوض'}).waitFor();
 await p.getByRole('button',{name:'تحديث',exact:true}).click();await p.locator('article strong').filter({hasText:'مرفوض'}).waitFor();
 await p.getByLabel('العمولة المستحقة',{exact:true}).selectOption(contract);await p.getByRole('button',{name:'طلب صرف العمولة',exact:true}).click();await p.locator('article strong').filter({hasText:'بانتظار الاعتماد'}).waitFor();assert.equal(store.requests.length,2);
 await a.getByRole('button',{name:'تحديث',exact:true}).click();await a.getByRole('button',{name:'اعتماد الطلب',exact:true}).click();await a.locator('article strong').filter({hasText:'معتمد'}).waitFor();
 await p.getByRole('button',{name:'تحديث',exact:true}).click();await p.locator('article strong').filter({hasText:'معتمد'}).waitFor();
 await p.getByRole('button',{name:'English',exact:true}).click();await p.getByRole('heading',{name:'My commission payout requests',exact:true}).waitFor();await p.setViewportSize({width:390,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 fs.mkdirSync('tmp/pdfs/payout-requests',{recursive:true});await p.screenshot({path:'tmp/pdfs/payout-requests/broker-mobile.png',fullPage:true});await a.screenshot({path:'tmp/pdfs/payout-requests/admin.png',fullPage:true});
 console.log('PASS payout UI: submit, pending tracking, other-broker fixture isolation, rejection reason, resubmit, executive approval, broker refresh, bilingual mobile layout. SQL/RLS not exercised.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
