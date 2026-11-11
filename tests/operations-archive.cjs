const assert=require('assert/strict'),crypto=require('crypto'),fs=require('fs'),{spawnSync}=require('child_process'),{loadTS}=require('./load-ts.cjs');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',entry='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',bytes=Buffer.from('%PDF-1.7\nfixture');
const document={id,entry_id:entry,filename:'receipt.pdf',mime:'application/pdf',size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),created_at:'2026-11-10T12:00:00Z'};
const snapshot={id,from:'2026-11-10',to:'2026-11-10',created_at:'2026-11-10T12:00:00Z',workspace:{role:'ADMIN',entries:[{id:entry,date:'2026-11-10',kind:'EXPENSE',amount:100,status:'APPROVED',holder:'COMPANY',reference:'REF',note:'',category:'Fixture'}],documents:[document],cases:[],dues:[],followups:[],history:[],units:[]}};
let corrupt=false,role='ADMIN';
class PortalError extends Error{constructor(status,message){super(message);this.status=status;}}
const route=loadTS('app/api/operations/export/documents/route.ts',{'@/lib/audit/server':{withAudit:f=>f},'@/lib/portal/server':{PortalError,apiError:e=>Response.json({error:e.message},{status:e.status||400}),requireIdentity:async(req,executive)=>{if(executive&&role!=='ADMIN')throw new PortalError(403,'Denied');return {user:{id},client:{rpc:async()=>({data:snapshot,error:null})}};},adminClient:()=>({rpc:async()=>({data:{...document,object_path:'private/fixture.pdf'},error:null}),storage:{from:()=>({download:async()=>({data:new Blob([corrupt?'wrong':bytes]),error:null})})}})}});
(async()=>{
 let response=await route.GET({nextUrl:new URL('http://test?id='+id)});assert.equal(response.status,200);
 fs.writeFileSync('/tmp/kohl-archive-api.zip',Buffer.from(await response.arrayBuffer()));
 const check=spawnSync('python3',['-c',"import zipfile; z=zipfile.ZipFile('/tmp/kohl-archive-api.zip'); assert z.testzip() is None; assert 'report.xlsx' in z.namelist(); assert 'manifest.json' in z.namelist(); assert len(z.namelist())==3; open('/tmp/kohl-archive-report.xlsx','wb').write(z.read('report.xlsx'))"],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);
 const XLSX=require('xlsx'),book=XLSX.readFile('/tmp/kohl-archive-report.xlsx');assert(book.SheetNames.includes('المستندات'));assert.equal(XLSX.utils.sheet_to_json(book.Sheets['الحركات'])[0]['المبلغ'],100);
 fs.unlinkSync('/tmp/kohl-archive-api.zip');fs.unlinkSync('/tmp/kohl-archive-report.xlsx');
 corrupt=true;response=await route.GET({nextUrl:new URL('http://test?id='+id)});assert.equal(response.status,409,'never return a partially valid archive');
 role='EMPLOYEE';response=await route.GET({nextUrl:new URL('http://test?id='+id)});assert.equal(response.status,403);
 console.log('Accountant archive API: real XLSX/ZIP contents, integrity failure and executive-only access passed');
})().catch(e=>{console.error(e);process.exit(1);});
