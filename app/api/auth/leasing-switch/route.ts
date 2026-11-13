import { randomUUID, randomBytes } from 'node:crypto';
import { createClient, type Session } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { adminClient, apiError, json, PortalError } from '@/lib/portal/server';
import { withAudit } from '@/lib/audit/server';
import { auditContext } from '@/lib/audit/context';
import { RETURN_COOKIE, SESSION_SECONDS, openReturnSession, sealReturnSession, verifiedSessionId, requireSwitchOrigin, returnCookieOptions } from '@/lib/leasing/session';
export const dynamic = 'force-dynamic';
const client = () => createClient(process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {auth:{persistSession:false,autoRefreshToken:false}});
async function identity(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer) throw new PortalError(401,'سجّل الدخول أولاً.');
  const {data,error} = await client().auth.getUser(bearer);
  if (error || !data.user) throw new PortalError(401,'الجلسة غير صالحة.');
  const context=auditContext.getStore(); if(context) context.actor=data.user.id;
  return {user:data.user,bearer,sessionId:verifiedSessionId(bearer)};
}
async function control(actor:string,operation:string,payload:Record<string,unknown>={}) {
  const {data,error}=await adminClient().rpc('leasing_switch_admin',{actor,operation,payload});
  if(error || !data) throw new PortalError(error?.code==='42501'?403:503,'تبديل حساب التأجير غير متاح لهذا المستخدم.');
  return data as {owner_id:string;owner_name:string;specialist_id:string|null};
}
const tokens = (s:Session) => ({access_token:s.access_token,refresh_token:s.refresh_token});
function boundReturn(req:NextRequest, user:string, session:string) {
  const saved=openReturnSession(req.cookies.get(RETURN_COOKIE)?.value);
  if(saved.child!==user || saved.childSession!==session) throw new PortalError(403,'جلسة العودة لا تخص هذا الحساب.');
  return saved;
}
async function get(req:NextRequest) {
  try {
    const who=await identity(req);
    if(who.user.role==='kohl_leasing') {
      const saved=boundReturn(req,who.user.id,who.sessionId);
      const state=await control(saved.owner,'STATE');
      if(state.specialist_id!==who.user.id) throw new PortalError(403,'التبديل غير متاح.');
      return json({direction:'RETURN',name:state.owner_name});
    }
    await control(who.user.id,'STATE');
    return json({direction:'ENTER',name:'أخصائي التأجير'});
  } catch(e) {return apiError(e);}
}
async function post(req:NextRequest) {
  try {
    requireSwitchOrigin(req);
    const who=await identity(req);
    const raw=await req.text();
    if(raw.length>8192) throw new PortalError(413,'طلب كبير.');
    let body; try {body=JSON.parse(raw);} catch {throw new PortalError(400,'طلب غير صالح.');}
    if(!body || typeof body!=='object' || Array.isArray(body)) throw new PortalError(400,'طلب غير صالح.');
    if(body.operation==='RETURN') {
      if(who.user.role!=='kohl_leasing' || Object.keys(body).some(k=>k!=='operation')) throw new PortalError(403,'التبديل غير متاح.');
      const saved=boundReturn(req,who.user.id,who.sessionId);
      const state=await control(saved.owner,'STATE');
      if(state.specialist_id!==who.user.id) throw new PortalError(403,'التبديل غير متاح.');
      const {data,error}=await client().auth.refreshSession({refresh_token:saved.refreshToken});
      if(error || !data.session || data.user?.id!==saved.owner || verifiedSessionId(data.session.access_token)!==saved.parentSession)
        throw new PortalError(401,'سجّل الدخول مجدداً بحساب محمد.');
      // DB scope is revoked first. Even if Auth logout fails, the child JWT cannot act.
      await control(saved.owner,'END',{child_session:who.sessionId});
      await adminClient().auth.admin.signOut(who.bearer,'local');
      const response=json({session:tokens(data.session),destination:'/dashboard'});
      response.cookies.set(RETURN_COOKIE,'',{...returnCookieOptions(req),maxAge:0});
      return response;
    }
    if(body.operation!=='ENTER' || who.user.role==='kohl_leasing'
      || Object.keys(body).some(k=>!['operation','refresh_token'].includes(k))
      || typeof body.refresh_token!=='string' || body.refresh_token.length<10 || body.refresh_token.length>4096)
      throw new PortalError(400,'طلب تبديل غير صالح.');
    let state=await control(who.user.id,'STATE');
    const admin=adminClient();
    if(!state.specialist_id) {
      // Admin create + generateLink do not send an invitation/email. No shared password.
      const {data,error}=await admin.auth.admin.createUser({email:`leasing-${randomUUID()}@accounts.kohl.invalid`,email_confirm:true,
        password:randomBytes(48).toString('base64url'),role:'kohl_leasing'});
      if(error || !data.user) throw new PortalError(503,'تعذر تجهيز حساب التأجير.');
      state=await control(who.user.id,'REGISTER',{id:data.user.id});
      // A simultaneous first switch can win registration. An unlinked Auth identity has no scope.
      if(state.specialist_id!==data.user.id) await admin.auth.admin.deleteUser(data.user.id);
    }
    const {data:account,error:accountError}=await admin.auth.admin.getUserById(state.specialist_id!);
    if(accountError || account.user?.role!=='kohl_leasing' || !account.user.email) throw new PortalError(403,'حساب التأجير غير مهيأ.');
    const {data:link,error:linkError}=await admin.auth.admin.generateLink({type:'magiclink',email:account.user.email});
    if(linkError || !link.properties?.hashed_token) throw new PortalError(503,'تعذر بدء جلسة التأجير.');
    const {data:login,error:loginError}=await client().auth.verifyOtp({type:'magiclink',token_hash:link.properties.hashed_token});
    if(loginError || !login.session || login.user?.id!==state.specialist_id || login.user.role!=='kohl_leasing')
      throw new PortalError(503,'تعذر بدء جلسة التأجير.');
    const childSession=verifiedSessionId(login.session.access_token);
    const cookie=sealReturnSession({owner:who.user.id,parentSession:who.sessionId,child:state.specialist_id!,childSession,
      refreshToken:body.refresh_token,expires:Date.now()+SESSION_SECONDS*1000});
    try {await control(who.user.id,'BEGIN',{child_session:childSession,parent_session:who.sessionId});}
    catch(e) {await admin.auth.admin.signOut(login.session.access_token,'local');throw e;}
    const response=json({session:tokens(login.session),destination:'/leasing'});
    response.cookies.set(RETURN_COOKIE,cookie,returnCookieOptions(req));
    return response;
  } catch(e) {return apiError(e);}
}
export const GET=withAudit(get);
export const POST=withAudit(post);
