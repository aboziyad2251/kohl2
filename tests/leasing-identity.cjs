const assert=require('assert/strict'),{NextRequest}=require('next/server'),{loadTS}=require('./load-ts.cjs');
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture';
let role='kohl_leasing',profileRole='LEASING',rpcCalls=[];
const server=loadTS('lib/portal/server.ts',{
 '@/lib/audit/context':{auditContext:{getStore:()=>null},auditFetch:fetch},
 '@supabase/supabase-js':{createClient:()=>({auth:{getUser:async()=>({data:{user:{id:'child',role}}})},rpc:async(name)=>{rpcCalls.push(name);return{data:{account:{id:'child',role:profileRole}}};}})}
});
const req=(p,method='GET')=>new NextRequest('https://fixture.invalid'+p,{method,headers:{authorization:'Bearer fixture'}});
(async()=>{
 await server.requireIdentity(req('/api/operations'));assert.equal(rpcCalls.pop(),'leasing_profile');
 for(const path of ['/api/access/users','/api/operations/export','/api/operations/documents','/api/portal/dashboard','/api/search']){
  const count=rpcCalls.length;await assert.rejects(()=>server.requireIdentity(req(path)),e=>e.status===403);assert.equal(rpcCalls.length,count);
 }
 await assert.rejects(()=>server.requireIdentity(req('/api/operations','DELETE')),e=>e.status===403);
 await assert.rejects(()=>server.requireIdentity(req('/api/operations'),true),e=>e.status===403);
 profileRole='ADMIN';await assert.rejects(()=>server.requireIdentity(req('/api/operations')),e=>e.status===403);
 role='authenticated';profileRole='LEASING';await assert.rejects(()=>server.requireIdentity(req('/api/operations')),e=>e.status===403);
 role='authenticated';profileRole='ADMIN';await server.requireIdentity(req('/api/access/users'),true);assert.equal(rpcCalls.pop(),'portal_me');
 console.log('Identity gate passed: leasing path/method scope, executive denial, JWT/private role mismatch denial, preserved normal admin access');
})().catch(e=>{console.error(e);process.exit(1)});
