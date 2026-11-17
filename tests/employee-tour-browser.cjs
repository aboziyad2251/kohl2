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
  await page.goto(base+'/leasing');
  const dialog=page.getByRole('dialog');await dialog.waitFor();
  assert.equal(await dialog.getByRole('option').count(),25);
  assert.equal(await dialog.getByRole('button',{name:'السابق',exact:true}).isDisabled(),true);
  await dialog.getByRole('button',{name:'التالي',exact:true}).click();
  await dialog.getByRole('heading',{name:'مساحة عملك',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'السابق',exact:true}).click();
  await dialog.getByRole('heading',{name:'مرحباً بك في كحل',exact:true}).waitFor();
  await dialog.getByRole('combobox').selectOption('24');
  assert.equal(await dialog.getByRole('button',{name:'فتح قسم التأجير ومتابعة العملاء',exact:true}).count(),1);
  assert(!await dialog.getByRole('option').filter({hasText:'الموظفون والرواتب'}).count());
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await page.reload();await page.getByRole('button',{name:'جولة النظام',exact:true}).waitFor();
  assert.equal(await dialog.isVisible(),false);
  await page.getByRole('button',{name:'جولة النظام',exact:true}).click();
  await dialog.waitFor();await dialog.getByRole('combobox').selectOption('24');
  await dialog.getByRole('button',{name:'فتح قسم التأجير ومتابعة العملاء',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'جولة النظام',exact:true}).click();
  await dialog.getByRole('button',{name:'إنهاء الجولة',exact:true}).click();
  assert.equal(await page.evaluate(id=>localStorage.getItem('kohl:onboarding:v1:'+id),id),'completed');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Tour browser passed desktop/mobile: 25 scoped steps, next/back/jump, Escape skip persistence, reopen, open section, complete');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
