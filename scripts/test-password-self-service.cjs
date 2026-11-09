// Synthetic browser sessions only. No real user credential or password is changed.
const fs=require('node:fs'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const {chromium}=require('C:/Users/moham/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.PASSWORD_QA_URL||'http://127.0.0.1:3110';
const helper=fs.readFileSync('scripts/test-attention-browser.cjs','utf8').split('(async () => {')[0];
const projectRequire=createRequire(process.cwd()+'/scripts/test-attention-browser.cjs');
const {prepare}=new Function('require','process',helper+'; return {prepare};')(name=>name==='playwright'?{chromium}:projectRequire(name),{env:{ATTENTION_QA_URL:base}});
const password='Synthetic-QA-Password-2026!';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const role of ['ADMIN','CEO','HR','EMPLOYEE','BROKER','OWNER','TENANT']){
  const ctx=await prepare(browser,role);let updates=0,profileAllowed=true;const errors=[];
  await ctx.route('**/auth/v1/user',route=>{
   if(route.request().method()==='PUT'){updates++;const body=route.request().postDataJSON();assert.deepEqual(Object.keys(body).filter(key=>!['code_challenge','code_challenge_method'].includes(key)),['password']);assert.equal(body.password,password);}
   return route.fulfill({json:{id:'00000000-0000-4000-8000-000000000001',email:'qa@test.invalid',app_metadata:{},user_metadata:{}}});
  });
  await ctx.route('**/auth/v1/logout*',route=>route.fulfill({status:204}));
  await ctx.route('**/api/portal/me',route=>profileAllowed?route.fallback():route.fulfill({status:403,json:{error:'Account disabled'}}));
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  if(!process.env.PASSWORD_QA_ACCOUNTS_ONLY && ['BROKER','OWNER','TENANT'].includes(role)){await page.goto(base+'/portal');await page.getByRole('link',{name:'تغيير كلمة المرور',exact:true}).click();}
  else await page.goto(base+'/auth/set-password');
  await page.getByLabel('كلمة المرور الجديدة',{exact:true}).fill(password);
  await page.getByLabel('تأكيد كلمة المرور',{exact:true}).fill(password+'mismatch');
  await page.getByRole('button',{name:'حفظ كلمة المرور',exact:true}).click();await page.locator('form [role=alert]').waitFor();assert.equal(updates,0);
  await page.getByLabel('تأكيد كلمة المرور',{exact:true}).fill(password);
  if(role==='BROKER'){
   profileAllowed=false;await page.getByRole('button',{name:'حفظ كلمة المرور',exact:true}).click();await page.locator('form [role=alert]').filter({hasText:'Unable to set password'}).waitFor();assert.equal(updates,0,'Disabled private account cannot use the password UI');profileAllowed=true;
  }
  await page.getByRole('button',{name:'English',exact:true}).click();await page.getByRole('button',{name:'Save password',exact:true}).click();
  await page.getByText('Password saved. Sign in again with your new password or Google.',{exact:true}).waitFor();assert.equal(updates,1);assert.equal(await page.locator('input[type=password]').count(),0);assert.deepEqual(errors,[]);
  await ctx.close();console.log(role+': own-password flow, mismatch, sign-out and bilingual UI passed');
 }
 const denied=await prepare(browser,'BROKER');await denied.route('**/api/portal/me',r=>r.fulfill({status:403,json:{error:'Not approved'}}));const page=await denied.newPage();await page.goto(base+'/auth/set-password');await page.locator('form [role=alert]').waitFor();assert.equal(await page.locator('input[type=password]').count(),0);await denied.close();
 const invalid=await prepare(browser,'BROKER');const invalidPage=await invalid.newPage();await invalidPage.goto(base+'/auth/set-password?error=expired');await invalidPage.locator('form [role=alert]').waitFor();assert.equal(await invalidPage.locator('input[type=password]').count(),0,'Invalid reset link cannot fall back to another active session');await invalid.close();
 const recovery=await prepare(browser,'BROKER');let recoveryUserChecks=0;
 await recovery.route('**/auth/v1/user',route=>{recoveryUserChecks++;return route.fulfill({json:{id:'00000000-0000-4000-8000-000000000001',email:'qa@test.invalid',app_metadata:{},user_metadata:{}}});});
 const recoveryJwt=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:'00000000-0000-4000-8000-000000000001',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fake'].join('.');
 const recoveryPage=await recovery.newPage();await recoveryPage.goto(base+'/auth/set-password#access_token='+recoveryJwt+'&refresh_token=fake-recovery&expires_in=3600&token_type=bearer&type=recovery');await recoveryPage.getByLabel('كلمة المرور الجديدة',{exact:true}).waitFor();assert.equal(recoveryUserChecks,1,'The configured implicit recovery session is initialized once');assert.equal(new URL(recoveryPage.url()).hash,'');await recovery.close();
 for(const suffix of ['?error=access_denied&error_description=expired','#error=access_denied&error_description=expired','?code=invalid-code']){const ctx=await prepare(browser,'BROKER');await ctx.route('**/auth/v1/token?*',r=>r.fulfill({status:400,json:{error:'invalid_grant',error_description:'Invalid recovery code'}}));const p=await ctx.newPage();await p.goto(base+'/auth/set-password'+suffix);try{await p.locator('form [role=alert]').waitFor();}catch(error){console.error('Recovery failure case:',suffix,await p.locator('body').innerText());throw error;}assert.equal(await p.locator('input[type=password]').count(),0,'Failed recovery cannot reuse an existing session');await ctx.close();}
 const anonymous=await browser.newContext();const anonPage=await anonymous.newPage();await anonPage.goto(base+'/auth/set-password');await anonPage.locator('form [role=alert]').waitFor();assert.equal(await anonPage.locator('input[type=password]').count(),0);await anonymous.close();
 for(const english of [false,true]){
  const ctx=await browser.newContext();let sends=0;
  await ctx.route('**/auth/v1/recover*',r=>{sends++;const u=new URL(r.request().url());assert.equal(u.searchParams.get('redirect_to'),base+'/auth/set-password');assert.equal(r.request().postDataJSON().email,'unknown-qa@test.invalid');return r.fulfill({json:{}});});
  const p=await ctx.newPage();await p.goto(base+'/auth/forgot-password');if(english)await p.getByRole('button',{name:'English',exact:true}).click();
  await p.locator('input[type=email]').fill('unknown-qa@test.invalid');await p.locator('form button[type=submit],form button:not([type])').click();
  await p.getByRole('status').filter({hasText:english?'If this email is registered':'إذا كان هذا البريد مسجلاً'}).waitFor();assert.equal(sends,1);await ctx.close();
 }
 console.log('Recovery request, bilingual generic response, unapproved/signed-out guards, expired links and one-time implicit initialization passed');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
