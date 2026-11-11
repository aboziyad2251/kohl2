/* Isolated UI checks. Requires Playwright and a locally running Next server.
   All Auth/backend/API responses use fixtures; no production access. */
const { chromium } = require('playwright');
const assert = require('assert/strict');
const fs = require('fs');
const origin = process.env.KOHL_TEST_ORIGIN || 'http://127.0.0.1:3100';
const output = process.env.KOHL_TEST_ARTIFACTS || '/tmp/kohl-operations-ui';
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
  await context.addInitScript(({session})=>{ for(const key of ['sb-127-auth-token','sb-kohl-auth-token']) if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(session)); },{session});
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    const json=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(url.pathname.startsWith('/auth/v1/')||url.pathname.startsWith('/rest/v1/')){
      if(url.pathname.startsWith('/auth/v1/')) return json(url.pathname.endsWith('/user')?user:session);
      if(url.pathname.includes('/rpc/portal_me')) return json(profile());
      return json([]);
    }
    if(url.origin!==origin) return route.abort();
    if(url.pathname==='/api/operations'){
      if(route.request().method()==='POST'){
        const p=route.request().postDataJSON();writes.push(p);
        if(p.operation==='CASE_CREATE') data.cases.unshift({id:p.id,lead_id:p.lead_id,customer_name:'عميل تجريبي',phone:'0500000000',assignee_id:id,assignee_name:'موظف تجريبي',kind:p.kind,source:p.source,need:p.need,stage:'NEW',unit_id:null,start_date:null,end_date:null,amount:null,beneficiary:null,contract_id:null,version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
        if(p.operation==='INSTALLMENTS_SAVE'){data.dues=p.parts.map((part,i)=>({...part,id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(i+10).padStart(12,'0'),sequence:i+1,case_id:p.case_id,voided:false}));data.cases.find(c=>c.id===p.case_id).version++;}
        if(p.operation==='ENTRY_CREATE')data.entries.unshift({...p,status:'PENDING',created_by:id,created_at:new Date().toISOString(),decision_note:''});
        if(p.operation==='ENTRY_DECIDE'){const e=data.entries.find(e=>e.id===p.id);e.status=p.status;e.decision_note=p.note;}
        return json({saved:true});
      }
      return json({...data,role:state.role});
    }
    if(url.pathname==='/api/operations/documents'){
     if(route.request().method()==='POST'){data.documents.push({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',entry_id:data.entries[0].id,filename:'receipt.pdf',mime:'application/pdf',size:16,sha256:'a'.repeat(64),created_at:new Date().toISOString()});return json({saved:true});}
     return route.fulfill({status:200,contentType:'application/pdf',body:Buffer.from('%PDF-1.7\nfixture')});
    }
    if(url.pathname==='/api/operations/export/documents')return route.fulfill({status:200,contentType:'application/zip',body:Buffer.from('fixture-archive')});
    if(url.pathname==='/api/operations/export')return json({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',from:today,to:today,created_at:new Date().toISOString(),workspace:data});
    if(url.pathname==='/api/audit/export'||url.pathname==='/api/auth/logout')return json({recorded:true});
    if(url.pathname==='/api/audit')return json({logs:[],total:0,page:0});
    if(url.pathname==='/api/audit/access')return json({users:[]});
    if(url.pathname==='/api/portal/me')return json(profile());
    if(url.pathname==='/api/portal/attention')return json(attention);
    if(url.pathname==='/api/portal/dashboard')return json({...portal,role:state.role});
    if(url.pathname==='/api/portal/payout-requests')return json({requests:[],total:0,page:0,eligible_contract_ids:[]});
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

const caseId='aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const writes=[];
const data={documents:[],role:'ADMIN',captured_at:new Date().toISOString(),cases:[{id:caseId,lead_id:id,customer_name:'عميل تجريبي',phone:'0500000000',assignee_id:id,assignee_name:'موظف تجريبي',kind:'DAILY',source:'هاتف',need:'وحدة لمدة ليلتين',stage:'CONFIRMED',qualified_at:new Date().toISOString(),unit_id:id,start_date:today,end_date:today,amount:1000,beneficiary:'OWNER',contract_id:null,version:2,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}],followups:[{id,case_id:caseId,title:'متابعة عرض الوحدة',due_at:new Date(Date.now()-3600000).toISOString(),completed_at:null,note:'',blocked_by:'NONE',assignee_id:id}],units:[{id,property_id:id,property_name:'عقار تجريبي',code:'101',readiness:'READY',note:'اعتمدت الجاهزية'}],entries:[],dues:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000010',sequence:1,case_id:caseId,amount:1000,due_date:today,voided:false}],leads:[{id,name:'عميل تجريبي',phone:'0500000000',source:'HATIF'}],properties:[{id,property_name:'عقار تجريبي'}],staff:[{id,name:'موظف تجريبي'}],contracts:[],history:[]};
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.KOHL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const errors=[];
 try{
  let context=await contextFor(browser),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await ready(page,'/leasing');await page.getByRole('heading',{name:'التأجير ومتابعة العملاء',exact:true,level:1}).waitFor();await noOverflow(page);
  await page.screenshot({path:output+'/leasing-desktop.png',fullPage:true});
  await page.getByRole('heading',{name:'انتهاء المدة والتجديد',exact:true}).waitFor();
  await page.getByRole('button',{name:'إضافة متابعة للمدة',exact:true}).click();
  assert.equal(await page.locator('[role=dialog] select[name=case_id]').inputValue(),caseId);
  assert.equal(await page.getByLabel('الإجراء المطلوب',{exact:true}).inputValue(),'تنسيق المغادرة أو التمديد');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'طلبات التأجير',exact:true}).click();
  await page.getByRole('button',{name:'طلب تأجير جديد',exact:true}).click();
  await page.getByLabel('العميل الموجود').selectOption(id);await page.getByLabel('نوع التأجير').selectOption('MONTHLY');
  await page.getByLabel('الاحتياج والميزانية').fill('شهري 3000 ريال');await page.getByLabel('الخطوة القادمة').fill('إرسال الخيارات');await page.getByLabel('موعد المتابعة بتوقيت الرياض').fill('2026-11-12T10:00');
  await page.getByRole('button',{name:'حفظ',exact:true}).click();await page.getByText('تم الحفظ.',{exact:true}).waitFor();assert(writes.some(p=>p.operation==='CASE_CREATE'&&p.kind==='MONTHLY'));
  await ready(page,'/financials/internal');
  await page.getByRole('button',{name:'المستحقات',exact:true}).click();await page.locator('.ops-installments summary').click();
  await page.getByLabel('مبلغ الدفعة 1',{exact:true}).fill('600');await page.getByRole('button',{name:'إضافة دفعة',exact:true}).click();await page.getByLabel('مبلغ الدفعة 2',{exact:true}).fill('400');await page.getByLabel('تاريخ الدفعة 2',{exact:true}).fill('2026-12-11');await page.getByLabel('سبب اعتماد الجدول').fill('دفعتان متفقتان');await page.getByRole('button',{name:'اعتماد جدول الدفعات'}).click();await page.getByText('تم الحفظ.',{exact:true}).waitFor();assert.equal(data.dues.length,2);
  await page.screenshot({path:output+'/installments-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'الحركات والمراجعة',exact:true}).click();await page.getByRole('button',{name:'تسجيل حركة',exact:true}).click();
  await page.getByLabel('طلب التأجير المؤكد (اختياري للمصروف العام)').selectOption(caseId);await page.getByLabel('نوع الحركة').selectOption('RECEIPT');await page.getByLabel('الدفعة المرتبطة').selectOption(data.dues[0].id);await page.getByLabel('المبلغ بالريال').fill('500');await page.getByLabel('الجهة المستلمة / الدافعة').selectOption('PLATFORM');await page.getByLabel('مرجع التحويل أو المستند (فريد لدى الجهة)').fill('TEST-REF');await page.getByLabel('التصنيف',{exact:true}).fill('إيجار');await page.getByRole('button',{name:'حفظ',exact:true}).click();await page.getByText('تم الحفظ.',{exact:true}).waitFor();
  await page.locator('.ops-documents summary').click();await page.getByLabel('مستند الحركة').setInputFiles({name:'receipt.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nfixture')});await page.getByRole('button',{name:'رفع المستند',exact:true}).click();await page.getByRole('button',{name:'receipt.pdf',exact:true}).waitFor();assert.equal(data.documents.length,1);
  await page.getByRole('button',{name:'مراجعة',exact:true}).click();await page.getByLabel('قرار المراجعة').selectOption('APPROVED');await page.getByLabel('نتيجة المطابقة أو سبب الرفض').fill('مطابق للكشف التجريبي');await page.getByRole('button',{name:'حفظ',exact:true}).click();await page.getByText('تم الحفظ.',{exact:true}).waitFor();assert.equal(data.entries[0].status,'APPROVED');
  await page.getByRole('button',{name:'تقرير المحاسب',exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'حفظ نسخة وتصدير Excel'}).click();assert((await downloaded).suggestedFilename().endsWith('.xlsx'));
  const archive=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل حزمة المحاسب مع المرفقات'}).click();assert((await archive).suggestedFilename().endsWith('.zip'));
  await page.screenshot({path:output+'/finance-desktop.png',fullPage:true});await context.close();
  context=await contextFor(browser,'EMPLOYEE',390);page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await ready(page,'/leasing');await noOverflow(page);await page.screenshot({path:output+'/leasing-mobile.png',fullPage:true});
  await ready(page,'/financials/internal');await page.getByRole('heading',{name:'المالية الداخلية',exact:true,level:1}).waitFor();assert.equal(await page.getByRole('button',{name:'مراجعة',exact:true}).count(),0);await noOverflow(page);await page.screenshot({path:output+'/finance-mobile.png',fullPage:true});await context.close();
  context=await contextFor(browser,'OWNER',390);page=await context.newPage();await page.goto(origin+'/leasing');await page.waitForURL('**/portal');await context.close();
  assert.deepEqual(errors,[]);console.log('Operations browser passed: create request, installments, private documents, financial review, Excel/archive export, employee controls, external redirect, desktop/mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
