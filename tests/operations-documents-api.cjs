const assert=require('assert/strict'),{loadTS}=require('./load-ts.cjs');
const user='11111111-1111-4111-8111-111111111111',entry='22222222-2222-4222-8222-222222222222';
let role='EMPLOYEE',state=null,stored=null,removed=0,reserves=0,mode='normal';
class PortalError extends Error{constructor(status,message){super(message);this.status=status;}}
const storage={upload:async(path,bytes)=>{stored=mode==='storage-failure'?null:bytes;return {error:['storage-failure','storage-lost'].includes(mode)?{code:'fail'}:null};},remove:async()=>{removed++;stored=null;return {error:null};},download:async()=>({data:new Blob([stored||'']),error:null})};
const admin={storage:{from:()=>storage},rpc:async(name,{actor,operation,payload})=>{
 assert.equal(actor,user);
 if(operation==='RESERVE'){reserves++;state={...payload,object_path:'fixture/'+payload.id+'.pdf',status:'UPLOADING'};return {data:state,error:null};}
 if(operation==='FINISH'){state.status='READY';if(mode.startsWith('lost-finish'))return {error:{code:'fail'}};return {data:state,error:null};}
 if(operation==='READ'){if(mode==='lost-finish-read-error'||state?.status!=='READY')return {error:{code:'42501'}};return {data:state,error:null};}
 if(operation==='ABORT'){if(state?.status==='READY')return {error:{code:'42501'}};return {data:state,error:null};}
 throw Error(operation);
}};
const route=loadTS('app/api/operations/documents/route.ts',{'@/lib/audit/server':{withAudit:f=>f},'@/lib/portal/server':{requireIdentity:async()=>({user:{id:user},profile:{account:{role}}}),adminClient:()=>admin,PortalError,apiError:e=>Response.json({error:e.message},{status:e.status||400}),json:data=>Response.json(data)}});
async function upload(type='application/pdf',body='%PDF-1.7\nfixture'){const data=new FormData();data.set('entry_id',entry);data.set('file',new Blob([body],{type}),'../../fixture.pdf');return route.POST(new Request('http://fixture/upload',{method:'POST',body:data}));}
(async()=>{
 let r=await upload();assert.equal(r.status,200);assert.equal(reserves,1);assert.equal(state.filename,'.._.._fixture.pdf');assert.equal(state.status,'READY');
 r=await route.GET({nextUrl:new URL('http://fixture?id='+state.id)});assert.equal(r.status,200);assert((r.headers.get('content-disposition')||'').startsWith('attachment;'));assert.equal(await r.text(),'%PDF-1.7\nfixture');
 role='OWNER';r=await upload();assert.equal(r.status,403);assert.equal(reserves,1);role='EMPLOYEE';
 r=await upload('text/html','<html>');assert.equal(r.status,400);assert.equal(reserves,1);
 mode='storage-failure';r=await upload();assert.equal(r.status,503);assert.equal(removed,1);
 mode='storage-lost';r=await upload();assert.equal(r.status,200);assert.equal(removed,1);
 mode='lost-finish';r=await upload();assert.equal(r.status,200);assert.equal(removed,1,'committed attachment must survive lost finish response');
 mode='lost-finish-read-error';r=await upload();assert.equal(r.status,400);assert.equal(removed,1,'uncertain read cannot cause committed file deletion');
 mode='normal';stored=Buffer.from('changed');r=await route.GET({nextUrl:new URL('http://fixture?id='+state.id)});assert.equal(r.status,409);
 console.log('Documents API: authenticated scope, signatures, private downloads, integrity and safe failed-upload reconciliation passed');
})().catch(e=>{console.error(e);process.exit(1);});
