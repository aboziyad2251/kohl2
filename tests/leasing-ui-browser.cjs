// Component acceptance with synthetic API responses; never connects to production.
const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const modules={
 availability:'lib/operations/availability.ts',
 search:'components/operations/UnitAvailabilityPanel.tsx',
 reservations:'components/operations/ReservationControls.tsx',
 preview:'components/common/PrivateDocumentPreview.tsx',
};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<html lang="ar" dir="rtl"><body><div id="root"></div></body></html>');
 await page.addScriptTag({path:require.resolve('react').replace('/index.js','/umd/react.development.js')});
 await page.addScriptTag({path:require.resolve('react-dom').replace('/index.js','/umd/react-dom.development.js')});
 await page.addScriptTag({content:`window.factories={};window.cache={};window.requests=[];
 window.require=function(name){if(name==='react')return React;if(name==='@/lib/operations/client')return {operationsFetch:window.syntheticFetch};if(name==='@/lib/operations/availability')name='availability';if(cache[name])return cache[name].exports;const m={exports:{}};cache[name]=m;factories[name](m,m.exports,window.require);return m.exports;};
 window.syntheticFetch=async(path,init={})=>{requests.push({path,method:init.method||'GET'});
 if(path.includes('documents')){if(window.rejectDocument)throw new Error('غير مخول');return new Response(new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],{type:'image/png'}));}
 if(path.includes('reservations'))return {json:async()=>({server_now:'2026-11-22T10:00:00Z',reservations:[{case_id:'case',unit_id:'unit',from:'2026-12-01',to:'2026-12-02',expires_at:'2026-11-22T12:00:00Z',status:'ACTIVE',extended:false}]})};
 return {json:async()=>({units:[{id:'unit',code:'A',bedrooms:3,entrances:2,available:true,reason:'AVAILABLE'}],unknown_specs_excluded:1})};};
 window.mount=(name,props)=>{if(window.reactRoot)window.reactRoot.unmount();window.reactRoot=ReactDOM.createRoot(document.getElementById('root'));window.reactRoot.render(React.createElement(require(name).default,props));};`});
 for(const [name,file] of Object.entries(modules)){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText;
 await page.addScriptTag({content:`factories[${JSON.stringify(name)}]=function(module,exports,require){${code}\n};`});
 }
 // Automatic JSX normally used by Next; classic fixture needs React available globally.
 await page.evaluate(()=>mount('search',{units:[{id:'unit',code:'A',property_name:'مبنى تجريبي'}],contracts:[],canLink:false}));
 await page.getByLabel('وصف الشقة').fill('شقة ٣ غرف مدخلين');
 await page.getByRole('button',{name:'اقتراح فلاتر من الوصف'}).click();
 assert.equal(await page.getByLabel('عدد الغرف',{exact:true}).inputValue(),'3');
 assert.equal(await page.getByLabel('عدد المداخل',{exact:true}).inputValue(),'2');
 await page.getByLabel('من',{exact:true}).fill('2026-12-01');await page.getByLabel('إلى',{exact:true}).fill('2026-12-02');
 await page.getByRole('button',{name:'بحث التوفر',exact:true}).click();
 await page.getByText('استُبعدت 1 وحدة لعدم تسجيل المواصفات المطلوبة.').waitFor();
 assert((await page.evaluate(()=>requests)).some(r=>r.path.includes('bedrooms=3&entrances=2')));
 await page.getByLabel('عدد الغرف',{exact:true}).fill('4');
 assert.equal(await page.getByText('استُبعدت 1 وحدة لعدم تسجيل المواصفات المطلوبة.').count(),0,'Changed filters must discard old results');
 await page.evaluate(()=>mount('reservations',{cases:[{id:'case',customer_name:'عميل تجريبي',need:'شقة'}],units:[{id:'unit',code:'A'}],canManage:false,onChanged:()=>{}}));
 await page.getByText('المتبقي عند آخر تحديث: 120 دقيقة').waitFor();
 assert.equal(await page.getByText('تمديد أو إلغاء حجز').count(),0);
 await page.evaluate(()=>mount('preview',{path:'/api/operations/documents?id=synthetic',filename:'تجربة.png'}));
 await page.getByAltText('تجربة.png').waitFor();
 await page.evaluate(()=>{window.rejectDocument=true;mount('preview',{path:'/api/operations/documents?id=denied',filename:'محجوب.png'});});
 await page.getByRole('alert').filter({hasText:'غير مخول'}).waitFor();
 assert.equal(await page.getByRole('img').count(),0,'Denied preview must not retain prior image');
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile Arabic filters, stale result clearing, persisted hold state, hidden employee cancellation, authenticated preview denial');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
