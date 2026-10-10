// Local UI tests. All auth/business API requests intercepted; no production data.
const {chromium}=require('C:/Users/moham/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('fs');
const base='http://127.0.0.1:3112',id='00000000-0000-4000-8000-000000000001';
async function prepare(browser,role,width=1400){
 const ctx=await browser.newContext({viewport:{width,height:1000}});const requests=[],errors=[];
 const jwt=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:id})).toString('base64url'),'fake'].join('.');
 await ctx.addInitScript(({id,jwt})=>{const session={access_token:jwt,refresh_token:'fake',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id,email:'qa@test.invalid',user_metadata:{}}};['sb-51-auth-token','sb-kohl-auth-token'].forEach(k=>localStorage.setItem(k,JSON.stringify(session)));window.print=()=>{window.__printCalls=(window.__printCalls||0)+1;};},{id,jwt});
 let failNext=false;
 await ctx.route('**/*',async route=>{const url=new URL(route.request().url());const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 if(url.pathname==='/api/portal/me')return json({account:{id,name:'مستخدم تجريبي',role,history_only:false,phone:'0500000000'},owners:[],leases:[],broker_contracts:[],email:'qa@test.invalid'});
 if(url.pathname==='/api/portal/attention')return json({items:[],counts:{},total:0});
 if(url.pathname.startsWith('/rest/v1/'))return json([]);
 if(url.pathname.startsWith('/auth/v1/'))return json({id,email:'qa@test.invalid'});
 if(url.pathname==='/api/bills-forms'){const body=route.request().postDataJSON();requests.push(body);if(failNext){failNext=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA failure'})});}return json({number:`${body.form.kind}-${body.form.date.slice(0,4)}-00001`,form:body.form,createdAt:'2026-10-10T12:00:00Z'});}
 if(url.origin!==base)return route.abort();
 if(url.pathname.startsWith('/api/')&&url.pathname!='/api/auth/providers'){errors.push('Unexpected API '+url.pathname);return route.abort();}return route.continue();});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/bills-forms/rec');return {ctx,page,requests,errors,fail:()=>failNext=true};
}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/moham/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});fs.mkdirSync('tmp/pdfs',{recursive:true});
 try{
 for(const role of ['ADMIN','CEO','EMPLOYEE']){
 const {ctx,page,requests,errors,fail}=await prepare(browser,role,role==='EMPLOYEE'?390:1400);
 await page.getByRole('heading',{name:'الفواتير والسندات',exact:true}).waitFor();
 assert.equal(await page.getByText('تعيين الرقم يدوياً (الإدارة)',{exact:true}).count(),role==='EMPLOYEE'?0:1);
 await page.getByRole('button',{name:'حفظ وإصدار الرقم',exact:true}).click();await page.locator('.bills-module [role=alert]').waitFor();assert.equal(requests.length,0);
 await page.getByLabel('العميل / المستأجر / المستلم',{exact:true}).fill('عميل تجريبي');await page.getByLabel('العقار / الوحدة',{exact:true}).fill('الوحدة 12');await page.getByLabel('المبلغ قبل الضريبة (ر.س)',{exact:true}).fill('100.01');
 for(const kind of ['REC','VOU','INV','HND']){
 await page.getByLabel(/^نوع المستند/).selectOption(kind);
 if(kind==='INV'){await page.getByLabel('إضافة ضريبة القيمة المضافة 15%').check();assert.match(await page.locator('.bill-document').innerText(),/115.01/);await page.getByLabel(/^طبيعة المبلغ/).selectOption('أمانة طرف ثالث');assert.equal(await page.getByLabel('إضافة ضريبة القيمة المضافة 15%').count(),0);assert.match(await page.locator('.bill-document').innerText(),/100.01/);await page.getByLabel(/^طبيعة المبلغ/).selectOption('إيراد للمكتب');await page.getByLabel('إضافة ضريبة القيمة المضافة 15%').check();}
 if(kind==='HND'){await page.getByLabel('حالة الوحدة والعدادات والملاحظات').fill('الوحدة سليمة، قراءة العداد 123');await page.getByLabel('المفاتيح والمرفقات',{exact:true}).fill('مفتاحان');}
 await page.getByLabel(/^البيان \/ الغرض/).fill('بيانات اختبار محلية فقط');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,role+' '+kind+' mobile overflow');
 if(kind==='REC'){fail();await page.getByRole('button',{name:'حفظ وإصدار الرقم',exact:true}).click();await page.getByRole('alert').filter({hasText:'QA failure'}).waitFor();}
 await page.getByRole('button',{name:'حفظ وإصدار الرقم',exact:true}).click();await page.getByRole('button',{name:'طباعة / حفظ PDF',exact:true}).waitFor();
 if(kind==='REC')assert.equal(requests.at(-1).requestId,requests.at(-2).requestId,'retry request UUID');
 assert.match(await page.locator('.bill-document').innerText(),new RegExp(kind+'-\\d{4}-00001'));
 assert.equal(await page.getByLabel('العقار / الوحدة',{exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'طباعة / حفظ PDF',exact:true}).click();assert.ok(await page.evaluate(()=>window.__printCalls>0));
 if(role==='ADMIN'){await page.screenshot({path:`tmp/pdfs/bills-${kind}.png`,fullPage:true});await page.emulateMedia({media:'print'});assert.equal(await page.locator('fieldset').isVisible(),false);await page.screenshot({path:`tmp/pdfs/bills-${kind}-print.png`,fullPage:true});await page.emulateMedia({media:'screen'});}
 await page.getByRole('button',{name:'مستند جديد',exact:true}).click();assert.equal(await page.getByLabel('العقار / الوحدة',{exact:true}).isEnabled(),true);
 }
 assert.deepEqual(errors,[]);await ctx.close();console.log(role+': four templates, VAT, validation, retry, frozen issuance, print and responsive layout passed (mock API)');
 }
 for(const role of ['HR','OWNER','TENANT','BROKER']){const {ctx,page,requests}=await prepare(browser,role);if(role==='HR')await page.getByText('لا تملك صلاحية الدخول لهذه الصفحة.',{exact:true}).waitFor();else await page.waitForURL('**/portal',{waitUntil:'commit',timeout:30000});assert.equal(await page.getByRole('heading',{name:'الفواتير والسندات',exact:true}).count(),0);assert.equal(requests.length,0);await ctx.close();console.log(role+': UI route denied/redirected');}
 const ctx=await browser.newContext(),page=await ctx.newPage();await page.goto(base+'/bills-forms');await page.waitForURL('**/login',{waitUntil:'commit',timeout:30000});await ctx.close();
 const response=await fetch(base+'/api/bills-forms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,401);console.log('Anonymous page redirect and real API 401 passed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});





