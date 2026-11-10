import 'server-only';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { NextRequest } from 'next/server';
import { adminClient, requireIdentity, PortalError } from '@/lib/portal/server';
import { auditContext } from './context';
export const actions=['LOGIN','LOGOUT','CREATE','UPDATE','DELETE','EXPORT','FORM_SUBMIT'] as const;
export const AUDIT_SKIP_HEADER='x-kohl-audit-skip';
export function requestMetadata(req:NextRequest){
 const candidate=process.env.AUDIT_TRUST_PROXY==='true'?req.headers.get('x-forwarded-for')?.split(',')[0].trim():undefined;
 return {requestId:randomUUID(),ip:candidate&&isIP(candidate)?candidate:undefined,agent:req.headers.get('user-agent')?.slice(0,1000)};
}
export function auditModule(path:string){return path.includes('broker-cooperation')?'Broker Cooperation':path.includes('/auth/')?'Auth':path.includes('/properties')||path.includes('/property-map')||path.includes('/ownership-properties')||path.includes('/property-management')?'Properties':path.includes('/bills-forms')?'Bills & Forms':path.includes('/access/')?'Users':path.includes('/financials/kr')?'Daily Reports':path.includes('/hatif/')?'Hatif':path.includes('/audit')?'Audit':path.includes('/portal/')?'Portals':'Workspace';}
export async function recordAudit(action:typeof actions[number],module:string,details:Record<string,unknown>,recordId:string|null=null){
 const context=auditContext.getStore();const {error}=await adminClient().rpc('record_audit_event',{actor:context?.actor||null,action,area:module,target:recordId,metadata:details,ip:context?.ip||null,agent:context?.agent||null,correlation:context?.requestId||null,claimed_email:context?.claimedEmail||null});
 if(error)throw new PortalError(503,'تعذر تسجيل العملية في سجل التدقيق');
}
export function withAudit<T extends (...args:any[])=>Promise<Response>>(handler:T):T{
 return (async(...args:Parameters<T>)=>{const req=args[0] as NextRequest;return auditContext.run(requestMetadata(req),async()=>{
  let response:Response;try{response=await handler(...args);}catch(error){await recordAudit('FORM_SUBMIT',auditModule(new URL(req.url).pathname),{source:'api',method:req.method,path:new URL(req.url).pathname,outcome:'ERROR'}).catch(()=>console.error('[audit] request logging unavailable'));throw error;}
  if(response.ok&&response.headers.get(AUDIT_SKIP_HEADER)==='1'){response.headers.delete(AUDIT_SKIP_HEADER);return response;}
  // No bodies, credentials, query strings or response payloads enter request metadata.
  try{await recordAudit(req.method==='GET'||response.headers.get('content-disposition')?.includes('attachment')?'EXPORT':req.method==='DELETE'?'DELETE':['PUT','PATCH'].includes(req.method)?'UPDATE':'FORM_SUBMIT',auditModule(new URL(req.url).pathname),{source:'api',method:req.method,path:new URL(req.url).pathname,status:response.status,outcome:response.ok?'SUCCESS':'FAILURE'});}catch{console.error('[audit] request logging unavailable; database mutation triggers remain atomic');}
  return response;
 });}) as T;
}
export async function auditAccess(actor:string,operation='CHECK',payload:unknown={}){const {data,error}=await adminClient().rpc('audit_access',{actor,operation,payload});if(error)throw new PortalError(error.code==='42501'?403:503,'تعذر التحقق من صلاحية سجل التدقيق');return data;}
export async function requireAudit(req:NextRequest){const identity=await requireIdentity(req);if(identity.profile.account.history_only||!['ADMIN','CEO','HR','EMPLOYEE'].includes(identity.profile.account.role)||await auditAccess(identity.user.id)!==true)throw new PortalError(403,'سجل التدقيق متاح للإدارة المخولة فقط');return identity;}
