/* UI assertions use synthetic Auth/API mocks. Real session integration is tested separately. */
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs');
const base=process.env.KOHL_TEST_ORIGIN||'http://127.0.0.1:3100',out='/tmp/kohl-leasing-ui';
const id='dddddddd-dddd-4ddd-8ddd-000000000001',owner='dddddddd-dddd-4ddd-8ddd-000000000002';
function session(role){const uid=role==='LEASING'?id:owner;return {access_token:'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:uid,role:role==='LEASING'?'kohl_leasing':'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture',refresh_token:'fixture-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:uid,role:role==='LEASING'?'kohl_leasing':'authenticated',aud:'authenticated',email:'synthetic@example.invalid',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}};}
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});fs.mkdirSync(out,{recursive:true});try{
 for(const width of [1440,390]){
  let role='LEASING',calls=[];
  const w={role,cases:[],followups:[],entries:[],units:[],dues:[],leads:[],properties:[],staff:[{id,name:'أخصائي التأجير'}],contracts:[],history:[],captured_at:new Date().toISOString(),workflow:{manager_id:owner,final_id:owner,manager_name:'محمد',final_name:'سالم',assistant_available:true}};
  const context=await browser.newContext({viewport:{width,height:950},locale:'ar-SA'});
  await context.addInitScript(({session})=>{if(!localStorage.getItem('sb-127-auth-token'))localStorage.setItem('sb-127-auth-token',JSON.stringify(session));},{session:session(role)});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());const json=(v,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(v)});
   if(url.pathname.startsWith('/auth/v1/'))return json(url.pathname.endsWith('/user')?session(role).user:session(role));
   if(url.pathname.startsWith('/rest/v1/')){calls.push('DIRECT_REST');return json([]);}
   if(url.origin!==base)return route.abort();
   if(url.pathname==='/api/portal/me')return json({account:{id:role==='LEASING'?id:owner,name:role==='LEASING'?'أخصائي التأجير':'محمد',role,history_only:false},email:'synthetic@example.invalid',leasing_operator:{name:'محمد',expires_at:new Date(Date.now()+3600000).toISOString()},owners:[],leases:[],broker_contracts:[]});
   if(url.pathname==='/api/auth/leasing-switch'){
    if(req.method()==='GET')return json({direction:role==='LEASING'?'RETURN':'ENTER',name:role==='LEASING'?'محمد':'أخصائي التأجير'});
    calls.push(req.postDataJSON().operation);role=role==='LEASING'?'ADMIN':'LEASING';return json({session:session(role),destination:'/leasing'});
   }
   if(url.pathname==='/api/operations'){
    if(req.method()==='POST'){const p=req.postDataJSON();calls.push(p.operation);if(p.operation==='CONTACT_CREATE')w.leads.push({id:p.id,name:p.name,phone:p.phone,source:p.source});return json({saved:true});}
    return json(w);
   }
   if(url.pathname.startsWith('/api/'))return json({items:[],metrics:{},role,properties:[],contracts:[],payments:[],dues:[],ownership:[],maintenance:[],commissions:[],kpis:[],customers:[],audit:[]});
   return route.continue();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/leasing');await page.getByRole('heading',{name:'التأجير ومتابعة العملاء',level:1}).waitFor();
  assert.equal(await page.getByRole('link',{name:'المالية الداخلية',exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:'سجل علاقات العملاء',exact:true}).count(),0);
  await page.getByRole('button',{name:'طلبات التأجير',exact:true}).click();
  await page.getByRole('button',{name:'إضافة عميل تأجير جديد',exact:true}).click();
  await page.getByLabel('اسم العميل',{exact:true}).fill('عميل جديد');await page.getByLabel('رقم الجوال (05xxxxxxxx)').fill('0500000000');
  await page.getByRole('button',{name:'حفظ',exact:true}).click();await page.getByRole('status').filter({hasText:'تم الحفظ'}).waitFor();
  assert(calls.includes('CONTACT_CREATE'));assert(!calls.includes('DIRECT_REST'),'leasing must not mount broad DataProvider');
  await page.goto(base+'/users-access');await page.waitForURL(base+'/leasing');await page.getByRole('heading',{name:'التأجير ومتابعة العملاء',level:1}).waitFor();
  await page.getByTitle('الحساب الحالي',{exact:true}).click();
  await page.getByRole('button',{name:'العودة إلى محمد',exact:true}).waitFor();
  await page.screenshot({path:out+'/leasing-'+width+'.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await Promise.all([page.waitForEvent('framenavigated'),page.getByRole('button',{name:'العودة إلى محمد',exact:true}).click()]);
  await page.getByRole('heading',{name:'التأجير ومتابعة العملاء',level:1}).waitFor();
  await page.getByTitle('الحساب الحالي',{exact:true}).click();
  await Promise.all([page.waitForEvent('framenavigated'),page.getByRole('button',{name:'التبديل إلى أخصائي التأجير',exact:true}).click()]);
  await page.getByRole('heading',{name:'التأجير ومتابعة العملاء',level:1}).waitFor();
  assert(calls.includes('RETURN')&&calls.includes('ENTER'));assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Leasing UI passed at desktop/mobile: leasing-only links, contact form, denied-page redirect, no broad cache provider, switch/return controls');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
