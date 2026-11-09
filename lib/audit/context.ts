import { AsyncLocalStorage } from 'node:async_hooks';
export type AuditContext={requestId:string;actor?:string;ip?:string;agent?:string;claimedEmail?:string};
export const auditContext=new AsyncLocalStorage<AuditContext>();
export function auditFetch(input:RequestInfo|URL,init?:RequestInit){
 const context=auditContext.getStore();const headers=new Headers(input instanceof Request?input.headers:undefined);
 new Headers(init?.headers).forEach((v,k)=>headers.set(k,v));
 if(context){headers.set('x-kohl-request-id',context.requestId);if(context.actor)headers.set('x-kohl-audit-actor',context.actor);if(context.ip)headers.set('x-kohl-trusted-ip',context.ip);if(context.agent)headers.set('x-kohl-user-agent',context.agent);}
 return fetch(input,{...init,headers,cache:'no-store'});
}
