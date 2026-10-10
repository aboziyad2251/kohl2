const {prepare,base,chromium}=require('./standard-browser-helper.cjs'),{load}=require('./load-standard-model.cjs'),{fixture}=require('./test-standard-forms.cjs'),assert=require('node:assert/strict');
const {templates}=load('lib/forms/templates.ts');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Users/moham/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});
try{for(const role of ['ADMIN','EMPLOYEE']){const {ctx,page,requests,errors,fail}=await prepare(browser,role,role==='ADMIN'?1600:390);
 await page.goto(base+'/bills-forms');await page.getByRole('heading',{name:'الفواتير والسندات والنماذج',exact:true}).waitFor();assert.equal(await page.locator('a[href^="/bills-forms/"]').count(),14);
 for(const t of templates){await page.goto(base+'/bills-forms/'+t.slug);await page.getByRole('heading',{name:t.title,exact:true}).waitFor();const data=fixture(t);
 for(const field of t.fields.filter(f=>!f.computed)){const input=page.locator('label[data-input-key="'+field.key+'"]').locator('input,textarea,select');if(field.options)await input.selectOption(data.values[field.key]);else await input.fill(data.values[field.key]);}
 assert.equal(await page.locator('.standard-sheet').count(),t.pages);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,t.code+' mobile overflow');
 if(t.code==='KL'){fail();await page.getByRole('button',{name:'حفظ وإصدار الرقم',exact:true}).click();await page.getByRole('alert').filter({hasText:'QA failure'}).waitFor();}
 await page.getByRole('button',{name:'حفظ وإصدار الرقم',exact:true}).click();await page.getByRole('button',{name:'طباعة / حفظ PDF',exact:true}).waitFor();if(t.code==='KL')assert.equal(requests.at(-1).requestId,requests.at(-2).requestId);
 assert.equal(await page.locator('fieldset').evaluate(el=>el.disabled),true);assert.match(await page.locator('.standard-meta').first().innerText(),new RegExp(t.code+'-\\d{4}-00001'));
 await page.getByRole('button',{name:'طباعة / حفظ PDF',exact:true}).click();await page.waitForFunction(()=>window.__printCalls>0);
 if(role==='ADMIN'){await page.emulateMedia({media:'print'});await page.pdf({path:'tmp/pdfs/standard-'+t.code+'.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'print'});await page.locator('.standard-sheet').first().screenshot({path:'tmp/pdfs/standard-'+t.code+'.png'});await page.emulateMedia({media:'screen'});}
 await page.getByRole('button',{name:'مستند جديد',exact:true}).click();assert.equal(await page.locator('fieldset').evaluate(el=>el.disabled),false);}
 assert.deepEqual(errors,[]);await ctx.close();console.log(role+': ten independent templates, fields, retry, frozen issuance, print and responsive layout passed (mock API)');}
const response=await fetch(base+'/api/bills-forms/standard',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,401);console.log('Real standard API unauthenticated 401 passed');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


