// Headless UI verification against the isolated app, using fake QA sessions.
const { chromium } = require('playwright');
const fs = require('node:fs'), assert = require('node:assert/strict');
(async () => {
 const sessions = JSON.parse(fs.readFileSync('.portal-stage/qa-sessions.json','utf8'));
 const browser = await chromium.launch({headless:true,executablePath:process.env.PORTAL_QA_BROWSER});
 try {
  for (const role of ['TENANT_A','OWNER_A','BROKER_A','ADMIN','CEO']) {
   const context = await browser.newContext({viewport:{width:role==='ADMIN'?1440:390,height:900},locale:'ar-SA'});
   await context.addInitScript(session => {localStorage.setItem('sb-kohl-auth-token',JSON.stringify(session));},sessions[role]);
   // Every request to the compiled production Supabase URL is redirected to the
   // separate QA gateway. The browser never contacts production business APIs.
   await context.route('https://kohl.kohlestate-ksa.online/**',async route=>{const request=route.request();const url=request.url().replace('https://kohl.kohlestate-ksa.online','http://127.0.0.1:39053');const response=await route.fetch({url});await route.fulfill({response});});
   const page = await context.newPage();
   await page.goto('http://127.0.0.1:39050/'+(['ADMIN','CEO'].includes(role)?'portal-management':'portal'));
   await page.getByRole('heading',{name:role.startsWith('TENANT')?'بوابة المستأجر':role.startsWith('OWNER')?'بوابة المالك':role.startsWith('BROKER')?'بوابة الوسيط':'إدارة بوابات العملاء'}).waitFor();
   await page.getByText('جارٍ تحميل السجلات…').waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Horizontal overflow: '+role);
   await page.screenshot({path:'.portal-stage/'+role+'-overview.png',fullPage:true});
   await page.getByRole('button',{name:'English',exact:true}).click();
   const expected=role.startsWith('TENANT')?'Tenant portal':role.startsWith('OWNER')?'Owner portal':role.startsWith('BROKER')?'Broker portal':'Customer portal management';
   await page.getByRole('heading',{name:expected,exact:true}).waitFor();
   if(role==='TENANT_A') {await page.getByRole('button',{name:'Maintenance',exact:true}).click();await page.getByRole('heading',{name:'New maintenance request'}).waitFor();await page.screenshot({path:'.portal-stage/tenant-maintenance.png',fullPage:true});}
   if(role==='ADMIN') {await page.getByRole('button',{name:'Assignments & units',exact:true}).click();await page.getByRole('heading',{name:'Assign broker KPI'}).waitFor();await page.screenshot({path:'.portal-stage/executive-controls.png',fullPage:true});}
   console.log(role+': correct dashboard, Arabic/English navigation and responsive layout passed');
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
