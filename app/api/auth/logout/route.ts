import { NextRequest } from 'next/server';
import { requireIdentity,apiError,json,PortalError } from '@/lib/portal/server';
import { withAudit,recordAudit } from '@/lib/audit/server';
async function post(req:NextRequest){let logged=false;try{
 await requireIdentity(req);
 const url=process.env.SUPABASE_SERVER_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new PortalError(503,'Authentication unavailable');
 const response=await fetch(new URL('/auth/v1/logout?scope=global',url),{method:'POST',headers:{apikey:key,Authorization:req.headers.get('authorization')!},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok){logged=true;await recordAudit('LOGOUT','Auth',{source:'app_logout',outcome:'FAILURE',status:response.status});throw new PortalError(503,'تعذر إنهاء الجلسة؛ أعد المحاولة');}
 logged=true;await recordAudit('LOGOUT','Auth',{source:'app_logout',outcome:'SUCCESS'});return json({signed_out:true});
 }catch(e){if(!logged)await recordAudit('LOGOUT','Auth',{source:'app_logout',outcome:'FAILURE',reason:'REQUEST_OR_PROVIDER_ERROR'}).catch(()=>console.error('[audit] logout event unavailable'));return apiError(e);}}
export const POST=withAudit(post);
