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
 if(url.pathname==='/api/bills-forms'||url.pathname==='/api/bills-forms/standard'){const body=route.request().postDataJSON();requests.push(body);if(failNext){failNext=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA failure'})});}return json({number:`${body.form.kind}-${body.form.date.slice(0,4)}-00001`,form:body.form,createdAt:'2026-10-10T12:00:00Z'});}
 if(url.origin!==base)return route.abort();
 if(url.pathname.startsWith('/api/')&&url.pathname!='/api/auth/providers'){errors.push('Unexpected API '+url.pathname);return route.abort();}return route.continue();});
 const page=await ctx.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/bills-forms/rec');return {ctx,page,requests,errors,fail:()=>failNext=true};
}

module.exports={prepare,base,chromium};

