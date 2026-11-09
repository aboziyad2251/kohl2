/* Production-build UI test with synthetic Auth, ERP, Hatif and API fixtures only. */
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs');
const origin=process.env.KOHL_TEST_ORIGIN||'http://127.0.0.1:3000',output=process.env.KOHL_TEST_ARTIFACTS||'/tmp/kohl-kr-ui';
const id='11111111-1111-4111-8111-111111111111',day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const historicalDay='2026-10-20',archives=new Map(),managerId='22222222-2222-4222-8222-222222222222';
let viewerGranted=false;
const empty={summary:{achievements:[],inProgress:[],decisions:[]},tasks:[],improvements:[],communications:{inbound:null,outbound:null,missed:null,returned:null,abandoned:null,whatsappConversations:null,uniqueContacts:0,totalCalls:null,avgDurationSeconds:null,avgWaitSeconds:null,whatsappInbound:null,whatsappOutbound:null,pendingConversations:null},followups:[],carryovers:[],calls:[],operationalNotes:[],contacts:[],analysis:{source:'none',bullets:[]},strategies:[],tomorrow:[]};
const facts={financial:{received:0,thirdParty:0,officeRevenue:0,vat:0,transactions:0,source:'ERP · synthetic fixture'},propertyCount:1,availableUnits:null,commercialAvailableUnits:null,sources:['ERP synthetic fixture'],warnings:['بيانات اختبار معزولة؛ مؤشرات هاتف غير المتاحة لا تعد صفراً.'],capturedAt:new Date().toISOString()};
let report=null,property={id,title:'عقار اختبار معزول',property_name:'عقار اختبار معزول',property_type:'Residential',property_use:'Residential',property_kind:'VILLA',region:'منطقة اختبار',city:'مدينة اختبار',district:'حي اختبار',address:'عنوان اختبار',units_count:1,rooms:2,lounges:0,bathrooms:null,entrances:1,price:null,lessor_id:id},failSave=true;
const agenda=()=>report?.status==='PUBLISHED'?report.content.tomorrow.map(a=>({...a,id:a.id,assigned_user_id:id,status:'PENDING'})):[];
async function contextFor(browser,role='ADMIN',width=1440){
 const user={id:role==='EMPLOYEE'?managerId:id,email:'fixture@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()},payload=Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url');
 const session={access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.fixture`,refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
 const profile={get kr_reports(){return ['ADMIN','CEO'].includes(role)||role==='EMPLOYEE'&&viewerGranted;},account:{id:user.id,name:'مستخدم اختبار',role,history_only:false},email:user.email,owners:[],leases:[],broker_contracts:[]};
 const context=await browser.newContext({viewport:{width,height:1000},locale:'ar-SA'});
 await context.addInitScript(session=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),session);
 await context.route('**/*',async route=>{const url=new URL(route.request().url()),json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.port==='54321'){
   if(url.pathname.startsWith('/auth/v1/'))return json(url.pathname.endsWith('/user')?user:session);
   if(url.pathname.includes('/rpc/portal_me'))return json(profile);
   if(url.pathname.endsWith('/properties'))return json([property]);
   if(url.pathname.endsWith('/lessors'))return json([{id,name:'مالك اختبار'}]);
   return json([]);
  }
  if(url.origin!==origin)return route.abort();
  if(url.pathname==='/api/audit/export'||url.pathname==='/api/auth/logout')return json({recorded:true});
  if(url.pathname==='/api/audit')return json({logs:[],total:0,page:0});
  if(url.pathname==='/api/audit/access')return json({users:[]});
  if(url.pathname==='/api/portal/me')return json(profile);
  if(url.pathname==='/api/auth/providers')return json({google:false,recovery:false});
  if(url.pathname==='/api/portal/attention')return json({today:day,items:[],metrics:{overdueRent:0,overdueCount:0,expiringContracts:0,approvals:0,openMaintenance:0,unpaidCommission:0}});
  if(url.pathname==='/api/workspace/dashboard-metrics')return json({documentation:{total:0,documented:0,percentage:0},agencies:{active:0,expired:0,expiring:0,message:'لا توجد وكالات نشطة',tone:'amber'},ejar:{state:'UNLINKED',linked:0,pending:0,total:0,label:'غير مرتبط بإيجار'},activeContracts:0,totalProperties:1,activeBrokerage:0});
  if(url.pathname==='/api/workspace/agenda')return json({tasks:agenda(),limited:false});
  if(url.pathname===`/api/properties/${id}/profile`)return json({property:{latitude:null,longitude:null},media:[]});
  if(url.pathname===`/api/properties/${id}`){if(failSave){failSave=false;return json({error:'فشل حفظ تجريبي؛ أعد المحاولة.'},503);}const values=route.request().postDataJSON();property={...property,...values,specifications_edited:true};return json({property});}
  const executive=['ADMIN','CEO'].includes(role),canRead=executive||role==='EMPLOYEE'&&viewerGranted;
  const archive=()=>{const prior=structuredClone(report);archives.set(prior.revision,{report:prior,agenda:agenda(),reason:'حفظ التعديلات'});return [...(report.previous_versions||[]),{revision:prior.revision,report_status:prior.status,reason:'حفظ التعديلات',actor_name:'مستخدم اختبار',created_at:new Date().toISOString()}];};
  if(url.pathname==='/api/financials/kr/access'){
   if(!executive)return json({error:'Executive required'},403);
   if(route.request().method()==='GET')return json({users:[{user_id:managerId,name:'مدير اختبار مستقبلي',role:'EMPLOYEE',active:true,enabled:viewerGranted}]});
   const input=route.request().postDataJSON();assert.equal(input.user_id,managerId);viewerGranted=input.enabled;return json(input);
  }
  if(url.pathname==='/api/financials/kr/import'){if(!executive)return json({error:'Executive required'},403);const input=route.request().postDataJSON();assert.equal(input.report_date,report.report_date);report={...report,content:input.content,revision:report.revision+1,status:'PUBLISHED',previous_versions:archive()};return json({report});}
  if(url.pathname==='/api/financials/kr'){
   if(route.request().method()==='GET'){
    if(!canRead)return json({error:'التقرير متاح للإدارة المخولة فقط'},403);
    if(url.searchParams.has('revision'))return json({snapshot:archives.get(Number(url.searchParams.get('revision')))});
    return json({report:report?.report_date===url.searchParams.get('date')?report:null,recent:report?[{report_date:report.report_date}]:[],schedule:{enabled:true,report_time:'22:00:00',timezone:'Asia/Riyadh'},can_edit:executive});
   }
   if(!executive)return json({error:'Executive required'},403);
   const input=route.request().postDataJSON();
   if(input.operation==='PREPARE')report={id,report_date:input.report_date,status:'PUBLISHED',revision:1,content:structuredClone(empty),facts,prepared_name:'مستخدم اختبار',approved_name:null,approved_at:null,submitted_at:null,previous_versions:[]};
   else if(input.operation==='SAVE')report={...report,previous_versions:archive(),status:'PUBLISHED',approved_at:null,content:input.content,revision:report.revision+1};
   else return json({error:'Unsupported operation'},400);
   return json({report});
  }
  return route.continue();
 });return context;
}
async function ready(page,path){await page.goto(origin+path);await page.locator('.kohl-workspace').waitFor();}
async function noOverflow(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page has horizontal overflow');}
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({executablePath:process.env.KOHL_CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
 try{
  const admin=await contextFor(browser),page=await admin.newPage();page.on('pageerror',e=>errors.push(e.message));
  await ready(page,'/dashboard');await page.getByText('لا توجد وكالات نشطة',{exact:true}).waitFor();assert.equal(await page.getByText('معدل توثيق 100% منصة إيجار',{exact:true}).count(),0);
  await ready(page,'/ownership-properties');await page.getByText('فيلا · سكني',{exact:true}).waitFor();const card=page.locator('div.glass-panel').filter({has:page.getByText('عقار اختبار معزول',{exact:true})});
  assert.equal(await card.locator('dd').nth(1).innerText(),'0');assert.equal(await card.locator('dd').nth(2).innerText(),'—');
  let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
  await page.getByRole('button',{name:'تعديل العقار',exact:true}).click();const modal=page.getByRole('dialog',{name:'تعديل العقار',exact:true});await modal.waitFor();
  await modal.getByLabel('عدد الغرف',{exact:true}).fill('5');await modal.getByLabel('السعر',{exact:true}).fill('85000');
  await modal.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();await modal.getByRole('alert').filter({hasText:'فشل حفظ تجريبي'}).waitFor();assert.equal(await card.locator('dd').first().innerText(),'2');
  await modal.getByRole('button',{name:'حفظ التعديلات',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal(await card.locator('dd').first().innerText(),'5');assert.equal(await card.locator('dd').nth(2).innerText(),'—');assert.equal(navigations,0);
  await page.getByRole('button',{name:'ملف العقار · الموقع والصور والفيديو ↗',exact:true}).click();await page.getByRole('dialog',{name:'ملف العقار: عقار اختبار معزول',exact:true}).getByRole('button',{name:'تعديل العقار',exact:true}).click();await modal.waitFor();await modal.getByRole('button',{name:'إلغاء',exact:true}).click();
  await page.screenshot({path:output+'/property-cards.png',fullPage:true});
  await ready(page,'/financials/daily-reports');await page.getByLabel('تاريخ التقرير',{exact:true}).fill(historicalDay);await page.getByRole('button',{name:'إعداد من المصادر',exact:true}).click();await page.getByRole('tab',{name:'إقفال يوم العمل',exact:true}).waitFor();
  await page.getByRole('tab',{name:'ملحق ج٢ · التحليل وخطة الغد',exact:true}).click();const section=page.locator('#kr-panel-3');
  await section.getByLabel('ثانياً: قراءة تحليلية',{exact:true}).fill('تحليل اختبار يدوي موثق.');
  await section.locator('section').filter({has:page.getByRole('heading',{name:'رابعاً: خطة العمل ليوم العمل التالي',exact:true})}).getByRole('button',{name:'+ إضافة صف',exact:true}).click();
  await section.getByLabel('رابعاً: خطة العمل ليوم العمل التالي: الإجراء المطلوب 1',{exact:true}).fill('متابعة اختبار معزولة');
  await section.getByLabel('رابعاً: خطة العمل ليوم العمل التالي: المسؤول 1',{exact:true}).fill('مستخدم اختبار');
  await section.getByLabel('رابعاً: خطة العمل ليوم العمل التالي: مؤشر الإنجاز 1',{exact:true}).fill('إتمام المتابعة');
  await page.getByRole('button',{name:'حفظ التقرير',exact:true}).click();await page.getByRole('status').filter({hasText:'تم حفظ التقرير'}).waitFor();
  for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page);}
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:output+'/kr-analysis-draft.png',fullPage:true});
  assert.equal(await page.getByRole('button',{name:'رفع للإدارة',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'اعتماد التقرير وإضافة خطة الغد',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'إعادة فتح للتعديل',exact:true}).count(),0);
  assert.equal(await page.getByLabel('استيراد تقرير JSON',{exact:true}).isEnabled(),true);
  await page.getByLabel('استيراد تقرير JSON',{exact:true}).setInputFiles({name:'synthetic-historical.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({event_id:id,report_date:historicalDay,content:{...report.content,analysis:{source:'claude',bullets:['تحليل تاريخي مستورد للاختبار']}}}))});await page.getByText('تم استيراد التقرير وإتاحته للإدارة وتحديث الأجندة؛ الأرقام المالية من ERP.',{exact:true}).waitFor();
  const ceo=await contextFor(browser,'CEO'),ceoPage=await ceo.newPage();ceoPage.on('pageerror',e=>errors.push(e.message));await ready(ceoPage,'/financials/daily-reports');await ceoPage.getByLabel('تاريخ التقرير',{exact:true}).fill(historicalDay);await ceoPage.getByText(/الحالة: محفوظ ومرئي للإدارة/).first().waitFor();
  await ceoPage.emulateMedia({media:'print'});assert.equal(await ceoPage.locator('.kr-page:visible').count(),4);assert.equal(await ceoPage.locator('.kohl-desktop-sidebar:visible').count(),0);await ceoPage.pdf({path:output+'/KR-synthetic-management.pdf',format:'A4',printBackground:true});await ceoPage.emulateMedia({media:'screen'});
  await ready(ceoPage,'/today?date=2026-10-21');await ceoPage.getByText('متابعة اختبار معزولة',{exact:true}).waitFor();
  // Legacy approved records are editable directly and archived on the next save.
  report={...report,status:'APPROVED',approved_at:new Date().toISOString()};const previousVersion=report.revision;
  await ready(page,'/financials/daily-reports');await page.getByLabel('تاريخ التقرير',{exact:true}).fill(historicalDay);await page.getByRole('tab',{name:'ملحق ج٢ · التحليل وخطة الغد',exact:true}).click();await page.locator('#kr-panel-3').getByLabel('ثانياً: قراءة تحليلية',{exact:true}).fill('تعديل تاريخي مباشر دون إجراء اعتماد');await page.getByRole('button',{name:'حفظ التقرير',exact:true}).click();await page.getByRole('status').filter({hasText:'تم حفظ التقرير'}).waitFor();assert.equal(report.approved_at,null);
  await page.getByText('سجل الإصدارات السابقة',{exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل نسخة الإصدار '+previousVersion,exact:true}).click();const backup=await downloaded;const archived=JSON.parse(fs.readFileSync(await backup.path(),'utf8'));assert.equal(archived.report.status,'APPROVED');assert.equal(archived.report.revision,previousVersion);
  await page.getByText('صلاحية مشاهدة تقارير الإدارة',{exact:true}).click();const managerToggle=page.getByRole('checkbox',{name:/مدير اختبار مستقبلي/});await managerToggle.click();await page.waitForFunction(el=>el.checked,await managerToggle.elementHandle());assert.equal(viewerGranted,true);
  const manager=await contextFor(browser,'EMPLOYEE'),managerPage=await manager.newPage();managerPage.on('pageerror',e=>errors.push(e.message));await ready(managerPage,'/financials/daily-reports');await managerPage.getByLabel('تاريخ التقرير',{exact:true}).fill(historicalDay);await managerPage.getByText('صلاحية مشاهدة التقارير فقط.',{exact:true}).waitFor();assert.equal(await managerPage.getByRole('button',{name:'حفظ التقرير',exact:true}).count(),0);assert.equal(await managerPage.getByLabel('استيراد تقرير JSON',{exact:true}).count(),0);assert.equal(await managerPage.locator('.kr-workspace textarea').count(),0);
  assert.equal(await managerPage.getByText('صلاحية مشاهدة تقارير الإدارة',{exact:true}).count(),0);
  await managerToggle.click();await page.waitForFunction(el=>!el.checked,await managerToggle.elementHandle());assert.equal(viewerGranted,false);await managerPage.getByRole('button',{name:'إعادة تحميل',exact:true}).click();await managerPage.getByRole('alert').filter({hasText:'التقرير متاح للإدارة المخولة فقط'}).waitFor();assert.equal(await managerPage.locator('.kr-page').count(),0);
  assert.deepEqual(errors,[]);await admin.close();await ceo.close();await manager.close();console.log('PASS KR UI: no report approval/reopen steps, direct historic editing/import and agenda sync, saved-version download, Admin/CEO visibility, explicit read-only future manager grant/revocation, private controls, PDF and320–1440px layouts. Backend/auth fixtures isolated.');
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
})();
