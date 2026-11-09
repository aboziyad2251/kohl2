import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { apiError,json,PortalError } from '@/lib/portal/server';
import { withAudit,recordAudit } from '@/lib/audit/server';
import { auditContext } from '@/lib/audit/context';
async function post(req:NextRequest){let logged=false;try{
 const raw=await req.text();if(Buffer.byteLength(raw)>4096)throw new PortalError(413,'Request too large');
 const {email,password}=z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(1024)}).strict().parse(JSON.parse(raw));
 const context=auditContext.getStore();if(context)context.claimedEmail=email;
 const url=process.env.SUPABASE_SERVER_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new PortalError(503,'Authentication unavailable');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error||!data.session){logged=true;await recordAudit('LOGIN','Auth',{source:'password_login','outcome':'FAILURE',reason:error?.status===429?'RATE_LIMITED':'REJECTED'});throw new PortalError(error?.status===429?429:401,'تعذر تسجيل الدخول. تحقق من البيانات أو حاول لاحقاً.');}
 if(context)context.actor=data.user.id;
 logged=true;await recordAudit('LOGIN','Auth',{source:'password_login',outcome:'SUCCESS'});
 // Provider-table events independently cover successful OAuth and direct sign-outs.
 return json({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token}});
 }catch(e){if(!logged)await recordAudit('LOGIN','Auth',{source:'password_login',outcome:'FAILURE',reason:'REQUEST_OR_PROVIDER_ERROR'}).catch(()=>console.error('[audit] login event unavailable'));return apiError(e);}}
export const POST=withAudit(post);
