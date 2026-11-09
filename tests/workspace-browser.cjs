/* Isolated UI checks. Requires Playwright and a locally running Next server.
   All Auth/backend/API responses use fixtures; no production access. */
const { chromium } = require('playwright');
const assert = require('assert/strict');
const fs = require('fs');
const origin = process.env.KOHL_TEST_ORIGIN || 'http://127.0.0.1:3000';
const output = process.env.KOHL_TEST_ARTIFACTS || '/tmp/kohl-workspace-ui';
const id = '00000000-0000-4000-8000-000000000001';
const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const portal = {role:'ADMIN',today,properties:[],contracts:[],payments:[],dues:[],ownership:[],maintenance:[],commissions:[],kpis:[],customers:[],audit:[]};
const attention = {today,items:[],metrics:{overdueRent:0,overdueCount:0,expiringContracts:0,approvals:0,openMaintenance:0,unpaidCommission:0}};
const state = {role:'ADMIN',accountId:id};
function profile(){return {account:{id:state.accountId,name:'مستخدم تجريبي',role:state.role,history_only:false,employee_id:'00000000-0000-4000-8000-000000000002'},email:'fixture@example.invalid',owners:[],leases:[],broker_contracts:[]};}
async function contextFor(browser, role = 'ADMIN', width=1440, accountId=id){
  state.role=role;state.accountId=accountId;
  const user={id:accountId,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const payload=Buffer.from(JSON.stringify({sub:accountId,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url');
  const session={access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
  const context=await browser.newContext({viewport:{width,height:1000},locale:'ar-SA'});
  await context.addInitScript(({session})=>{ if (!localStorage.getItem('sb-127-auth-token')) localStorage.setItem('sb-127-auth-token',JSON.stringify(session)); },{session});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(url.port==='54321'){
      if(url.pathname.startsWith('/auth/v1/')) return json(url.pathname.endsWith('/user')?user:session);
      if(url.pathname.includes('/rpc/portal_me')) return json(profile());
      return json([]);
    }
    if(url.origin!==origin) return route.abort();
    if(url.pathname==='/api/audit/export'||url.pathname==='/api/auth/logout')return json({recorded:true});
    if(url.pathname==='/api/audit')return json({logs:[],total:0,page:0});
    if(url.pathname==='/api/audit/access')return json({users:[]});
    if(url.pathname==='/api/portal/me')return json(profile());
    if(url.pathname==='/api/portal/attention')return json(attention);
    if(url.pathname==='/api/portal/dashboard')return json({...portal,role:state.role});
    if(url.pathname==='/api/workspace/dashboard-metrics')return json({documentation:{total:0,documented:0,percentage:0},agencies:{active:0,expired:0,expiring:0,message:'لا توجد وكالات نشطة',tone:'amber'},ejar:{state:'UNLINKED',linked:0,pending:0,total:0,label:'غير مرتبط بإيجار'},activeContracts:0,totalProperties:1,activeBrokerage:0});
  if(url.pathname==='/api/workspace/agenda')return json({tasks:[],limited:false});
    if(url.pathname==='/api/workspace/calendar')return json({events:[{id:'fixture',source:'crm',date:today,title:'موعد تجريبي',href:'/crm?tab=activities'}],warnings:[]});
    if(url.pathname==='/api/workspace/activity')return json({events:[{id:'fixture',source:'access',date:today+'T10:00:00Z',action:'تحديث تجريبي',actor:'مستخدم تجريبي',href:'/users-access'}],warnings:[]});
    if(url.pathname==='/api/workspace/status')return json({checkedAt:today+'T10:00:00Z',database:true,hatif:{enabled:false,configured:false,lastRecordedActivity:null,observationAvailable:true},aiConfigured:false,googleEnabled:false,recoveryEnabled:false});
    if(url.pathname==='/api/access/users')return json({users:[],employees:[],properties:[],contracts:[],settings:{tenant_lease_end_action:'HISTORY'},audit:[]});
    if(url.pathname==='/api/auth/providers')return json({google:false,recovery:false});
    return route.continue();
  });
  return context;
}
async function ready(page,path){await page.goto(origin+path);try { await page.locator('.kohl-workspace').waitFor(); } catch(error) { console.error('UI state:',await page.locator('body').innerText()); await page.screenshot({path:output+'/failure.png'}); throw error; }}
async function noOverflow(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'horizontal overflow');}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.KOHL_CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const errors=[];
  try{
    let context=await contextFor(browser),page=await context.newPage();page.on('console',message=>{if(message.type()==='error')console.error('Browser:',message.text().slice(0,600));});page.on('pageerror',error=>errors.push(error.message));
    await ready(page,'/calendar');
    await page.getByText('موعد تجريبي',{exact:true}).last().waitFor();
    await page.getByRole('button',{name:'الشهر السابق',exact:true}).click();
    await page.getByRole('button',{name:'اليوم',exact:true}).click();
    await page.locator(`.calendar-day[data-today="true"][aria-pressed="true"]`).waitFor();
    await page.getByRole('heading',{name:new RegExp(`مواعيد ${today}`)}).waitFor();
    if (process.env.KOHL_TEST_VIEWPORTS_ONLY === 'true') {
      for (const width of [768,1024,1280,320,390]) {
        await page.setViewportSize({width,height:1000});
        await noOverflow(page);
        await ready(page,'/settings');await page.getByText('الاستقبال غير مفعّل',{exact:false}).waitFor();await noOverflow(page);
        await page.screenshot({path:output+`/settings-${width}.png`,fullPage:true});
        await ready(page,'/calendar');await page.getByText('موعد تجريبي',{exact:true}).last().waitFor();await noOverflow(page);
      }
      await context.close();
      console.log('PASS responsive viewports: calendar/settings at 320, 390, 768, 1024, 1280 pixels.');
      return;
    }
    assert.equal(await page.locator('.kohl-desktop-sidebar .kohl-nav-group').count(),6);
    await noOverflow(page);
    await page.screenshot({path:output+'/desktop-calendar.png',fullPage:true});
    const sidebar=page.locator('.kohl-desktop-sidebar');
    await sidebar.getByRole('button',{name:'إضافة إلى المفضلة: علاقات العملاء',exact:true}).click();
    assert.equal(await sidebar.getByRole('region',{name:'المفضلة',exact:true}).getByRole('link').count(),1);
    await page.reload();await sidebar.getByRole('region',{name:'المفضلة',exact:true}).waitFor();
    await sidebar.getByRole('button',{name:'العقود والخدمات',exact:true}).click();
    assert.equal(await sidebar.getByRole('button',{name:'العقود والخدمات',exact:true}).getAttribute('aria-expanded'),'false');
    await sidebar.getByRole('searchbox',{name:'بحث الأقسام والخدمات'}).fill('اداره الاملاك');
    assert.equal(await sidebar.getByRole('link',{name:'إدارة الأملاك',exact:true}).count(),1);
    await sidebar.getByRole('button',{name:'مسح بحث الأقسام',exact:true}).click();
    assert.equal(await sidebar.getByRole('searchbox').inputValue(),'');
    await page.getByRole('button',{name:'بحث الأقسام والخدمات',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'بحث الأقسام والخدمات'});
    await dialog.getByRole('searchbox').fill('المتابعات');await dialog.getByRole('searchbox').press('ArrowDown');
    await page.keyboard.press('Enter');await page.waitForURL('**/crm?tab=activities');
    await page.getByText('سجل المتابعات والاتصالات والمواعيد الميدانية',{exact:true}).waitFor();
    await page.getByRole('button',{name:/الصفقات والعمولات/}).click();await page.waitForURL('**/crm?tab=deals');
    await page.goBack();await page.waitForURL('**/crm?tab=activities');await page.getByText('سجل المتابعات والاتصالات والمواعيد الميدانية',{exact:true}).waitFor();
    await page.reload();await page.getByText('سجل المتابعات والاتصالات والمواعيد الميدانية',{exact:true}).waitFor();
    await ready(page,'/bills-forms/inv');
    assert.equal(await sidebar.locator('a[aria-current="page"]').getAttribute('href'),'/bills-forms');
    const party=page.getByLabel('العميل / المستأجر / المستلم',{exact:true});
    await party.fill('مسودة اختبار معزولة');await ready(page,'/calendar');await ready(page,'/bills-forms/inv');await party.waitFor();assert.equal(await party.inputValue(),'مسودة اختبار معزولة');
    await ready(page,'/settings');await page.getByText('الاستقبال غير مفعّل',{exact:false}).waitFor();await noOverflow(page);
    for(const mode of ['أسود داكن','أزرق داكن','فاتح · الافتراضي']){
      await page.locator('header .appearance-switch summary').click();await page.getByRole('button',{name:mode,exact:true}).click();
      assert.equal(await sidebar.evaluate(el=>getComputedStyle(el).colorScheme),'light');await noOverflow(page);
    }
    await page.screenshot({path:output+'/desktop-settings.png',fullPage:true});
    await ready(page,'/activity');await page.getByText('تحديث تجريبي',{exact:true}).waitFor();
    await ready(page,'/today?filter=overview');await page.getByText('لا توجد تنبيهات ضمن هذه الفئة حالياً.',{exact:true}).waitFor();
    // Same-browser account switch cannot inherit another account's preferences.
    state.accountId='00000000-0000-4000-8000-000000000009';
    await ready(page,'/calendar');assert.equal(await sidebar.getByRole('region',{name:'المفضلة',exact:true}).count(),0);
    await context.close();
    context=await contextFor(browser,'ADMIN',390);page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await ready(page,'/calendar');await page.getByText('موعد تجريبي',{exact:true}).last().waitFor();await noOverflow(page);
    assert.equal(await page.locator('.kohl-mobile-dock a[href="/crm"]').count(),1);
    await page.locator('.kohl-mobile-dock').getByRole('button',{name:'المزيد',exact:true}).click();
    const menu=page.getByRole('dialog',{name:'جميع أقسام كحل'});await menu.waitFor();
    assert.equal(await menu.locator('.kohl-nav-group').count(),6);
    await menu.getByRole('searchbox').fill('صيانة');assert(await menu.getByRole('link',{name:'صيانة الأملاك',exact:true}).isVisible());
    await menu.getByRole('button',{name:'إضافة إلى المفضلة: صيانة الأملاك',exact:true}).click();
    await page.screenshot({path:output+'/mobile-menu.png',fullPage:true});
    await page.keyboard.press('Escape');assert(!await menu.isVisible());
    await page.locator('.kohl-mobile-dock').getByRole('button',{name:'المزيد',exact:true}).click();await menu.getByRole('link',{name:'صيانة الأملاك',exact:true}).click();
    await page.waitForURL('**/property-management?tab=MAINTENANCE');assert(!await menu.isVisible());
    await page.locator('.kohl-mobile-dock').getByRole('button',{name:'المزيد',exact:true}).click();
    assert.equal(await menu.getByRole('link',{name:'صيانة الأملاك',exact:true}).getAttribute('data-selected'),'true');
    assert.equal(await menu.locator('.kohl-nav-group h2 button').count(),0);
    await page.keyboard.press('Escape');
    await ready(page,'/settings');await page.getByText('الاستقبال غير مفعّل',{exact:false}).waitFor();await noOverflow(page);await page.screenshot({path:output+'/mobile-settings.png',fullPage:true});
    await context.close();
    for(const role of ['HR','EMPLOYEE']){
      context=await contextFor(browser,role);page=await context.newPage();await ready(page,'/calendar');
      await page.getByLabel('المصدر',{exact:true}).waitFor();
      if(role==='HR') assert.equal(await page.getByLabel('المصدر',{exact:true}).locator('option').count(),2);
      if(role==='EMPLOYEE') assert.equal(await page.getByLabel('المصدر',{exact:true}).locator('option[value=portal]').count(),0);
      assert.equal(await page.locator('.kohl-desktop-sidebar a[href="/settings"]').count(),0);
      await page.goto(origin+'/settings');await page.getByText('لا تملك صلاحية الدخول لهذه الصفحة.',{exact:true}).waitFor();
      await context.close();
    }
    context=await contextFor(browser,'OWNER');page=await context.newPage();await page.goto(origin+'/calendar');await page.waitForURL('**/portal');assert.equal(await page.locator('.kohl-desktop-sidebar').count(),0);await context.close();
    assert.deepEqual(errors,[]);
    console.log('PASS browser: grouped RTL navigation, Arabic search/keyboard, favorites persistence/account isolation, collapse, deep links/history/reload, nested highlight, draft survival, all themes, mobile drawer/Escape/navigation, overflow, role restrictions, external portal routing. Mock Auth/backend only. Screenshots: '+output);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
