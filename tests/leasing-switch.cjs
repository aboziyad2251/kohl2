const assert=require('assert/strict');
const {NextRequest,NextResponse}=require('next/server'),{loadTS}=require('./load-ts.cjs');
class PortalError extends Error{constructor(status,message){super(message);this.status=status;}}
const id=n=>'cccccccc-cccc-4ccc-8ccc-'+String(n).padStart(12,'0');
process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-service-secret-not-a-real-key';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://synthetic.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='fixture';process.env.APP_ORIGIN='https://app.fixture.invalid';
const jwt=(uid,session)=>'header.'+Buffer.from(JSON.stringify({sub:uid,session_id:session})).toString('base64url')+'.synthetic';
const parent={user:{id:id(1),role:'authenticated'},access_token:jwt(id(1),id(2)),refresh_token:'parent-private-refresh-token'};
const child={user:{id:id(3),role:'kohl_leasing',email:'child@fixture.invalid'},access_token:jwt(id(3),id(4)),refresh_token:'child-refresh-token'};
let calls=[],parentAllowed=true,childRegistered=true;
const rpc=async(name,args)=>{calls.push([name,args.operation]);if(!parentAllowed||args.actor!==parent.user.id)return {error:{code:'42501'}};return {data:{owner_id:id(1),owner_name:'Synthetic Mohammed',specialist_id:childRegistered?id(3):null}};};
const auth={
 getUser:async(token)=>({data:{user:token===parent.access_token?parent.user:token===child.access_token?child.user:{id:id(90),role:'authenticated'}}}),
 refreshSession:async({refresh_token})=>refresh_token===parent.refresh_token?{data:{session:parent,user:parent.user}}:{data:{},error:{}},
 verifyOtp:async()=>({data:{session:child,user:child.user}}),
 admin:{getUserById:async()=>({data:{user:child.user}}),generateLink:async()=>({data:{properties:{hashed_token:'hashed-fixture'}}}),signOut:async()=>{calls.push(['logout']);return{};}}
};
const mocks={'@supabase/supabase-js':{createClient:()=>({auth})},'@/lib/portal/server':{PortalError,adminClient:()=>({rpc,auth}),json:d=>NextResponse.json(d),apiError:e=>NextResponse.json({error:e.message},{status:e.status||500})},'@/lib/audit/server':{withAudit:fn=>fn},'@/lib/audit/context':{auditContext:{getStore:()=>null}}};
const session=loadTS('lib/leasing/session.ts',mocks),route=loadTS('app/api/auth/leasing-switch/route.ts',mocks);
const request=(token,body,cookie,origin=process.env.APP_ORIGIN)=>new NextRequest(process.env.APP_ORIGIN+'/api/auth/leasing-switch',{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,origin,...(cookie?{cookie:session.RETURN_COOKIE+'='+cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
(async()=>{
 assert.equal((await route.GET(request(jwt(id(90),id(91))))).status,403);
 const foreign=await route.POST(request(parent.access_token,{operation:'ENTER',refresh_token:parent.refresh_token},null,'https://evil.invalid'));assert.equal(foreign.status,403);
 let response=await route.POST(request(parent.access_token,{operation:'ENTER',refresh_token:parent.refresh_token}));assert.equal(response.status,200);
 const entered=await response.json();assert.equal(entered.session.access_token,child.access_token);assert(!JSON.stringify(entered).includes(parent.refresh_token));
 const setCookie=response.headers.get('set-cookie');assert(setCookie.includes('HttpOnly')&&setCookie.includes('SameSite=strict')&&setCookie.includes('Secure'));
 const cookie=response.cookies.get(session.RETURN_COOKIE).value;assert(!cookie.includes(parent.refresh_token));
 assert.equal(session.openReturnSession(cookie).owner,id(1));
 assert.throws(()=>session.openReturnSession(cookie.slice(0,-5)+'AAAAA'),e=>e.status===401);
 assert.throws(()=>session.openReturnSession(session.sealReturnSession({owner:id(1),parentSession:id(2),child:id(3),childSession:id(4),refreshToken:'fixture',expires:Date.now()-1})),e=>e.status===401);
 assert.equal((await route.POST(request(parent.access_token,{operation:'RETURN'},cookie))).status,403);
 response=await route.POST(request(child.access_token,{operation:'RETURN'},cookie));assert.equal(response.status,200);
 assert.equal((await response.json()).session.access_token,parent.access_token);
 assert(response.headers.get('set-cookie').includes('Max-Age=0'));assert(calls.some(c=>c[1]==='END'));
 parentAllowed=false;assert.equal((await route.POST(request(child.access_token,{operation:'RETURN'},cookie))).status,403);
 console.log('Switch route passed: owner-only, Origin check, encrypted/bound return cookie, no parent tokens in child response, revocation before return');
})().catch(e=>{console.error(e);process.exit(1)});
