const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
const exports_={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/operations/availability.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:exports_,Date,Set});
const a=exports_,now=new Date('2026-11-21T21:15:00Z'); // Already Nov 22 in Riyadh.
assert.equal(a.holdHours('ANNUAL','2026-11-22',now),72);
assert.equal(a.holdHours('MONTHLY','2026-11-22',now),24);
assert.equal(a.holdHours('DAILY','2026-11-23',now),2);
assert.equal(a.holdHours('DAILY','2026-11-24',now),12);
assert.throws(()=>a.holdHours('DAILY','2026-11-21',now));
assert.throws(()=>a.validatePeriod({start:'2026-02-30',end:'2026-03-03'}));
const period={start:'2026-11-22',end:'2026-11-24'},unit={id:'unit',readiness:'READY',bedrooms:3,entrances:2};
const booking={...period,unitId:'unit',type:'BOOKING',state:'ACTIVE'};
assert.equal(a.unitAvailability(unit,period,[booking],now).available,false);
assert.equal(a.unitAvailability(unit,{start:'2026-11-24',end:'2026-11-25'},[booking],now).available,true);
assert.equal(a.unitAvailability({...unit,readiness:'CLEANING'},period,[],now).available,false);
const hold={...booking,type:'HOLD',expiresAt:now.toISOString()};
assert.equal(a.unitAvailability(unit,period,[hold],now).available,true);
assert.throws(()=>a.unitAvailability(unit,period,[{...hold,expiresAt:undefined}],now));
assert.equal(a.unitAvailability(unit,period,[{...booking,state:'CANCELLED'},{...booking,type:'CONTRACT'}],now).available,false);
assert.equal(a.unitAvailability(unit,period,[{...booking,state:'DRAFT'}],now).available,true);
assert.equal(a.matchesRequirements({...unit,entrances:null},{entrances:2}),false);
assert.equal(a.matchesRequirements(unit,{bedrooms:3,entrances:2}),true);
assert.equal(JSON.stringify(a.suggestRequirements('شقة ٣ غرف مدخلين')),JSON.stringify({bedrooms:3,entrances:2}));
console.log('PASS: Riyadh hold policy, date boundaries, occupancy/contract blockers, missing data and Arabic filter suggestions');

assert.equal(JSON.stringify(a.parseRequirementFilters(new URLSearchParams('bedrooms=3&entrances=2'))),JSON.stringify({bedrooms:3,entrances:2}));
for(const bad of ['bedrooms=0','bedrooms=-1','bedrooms=3.5','bedrooms=101','entrances=21','bedrooms=abc']) assert.throws(()=>a.parseRequirementFilters(new URLSearchParams(bad)));
assert.equal(JSON.stringify(a.parseRequirementFilters(new URLSearchParams('bedrooms=&entrances='))),'{}');
assert.equal(a.matchesRequirements({...unit,bedrooms:null},{bedrooms:3}),false);
console.log('PASS: explicit search filters validate ranges and reject missing apartment attributes');

const followups={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/operations/followups.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:followups,Date});
assert.equal(followups.suggestFollowupCategory({stage:'NEW',kind:'ANNUAL',start_date:null},'2026-11-22'),'CONTACT');
assert.equal(followups.suggestFollowupCategory({stage:'CONFIRMED',kind:'DAILY',start_date:'2026-11-22'},'2026-11-22'),'ARRIVAL');
assert.equal(followups.suggestFollowupCategory({stage:'CONFIRMED',kind:'DAILY',start_date:'2026-11-21'},'2026-11-22'),'DEPARTURE');
const grouped=followups.followupCategorySummary([
 {category:'VIEWING',due_at:'2026-11-21T21:30:00Z',completed_at:null},
 {category:'VIEWING',due_at:'2026-11-22T12:00:00Z',completed_at:'2026-11-22T11:00:00Z'},
 {category:'CONTACT',due_at:'2026-11-22T21:01:00Z',completed_at:null}
],'2026-11-22','2026-11-22');
assert.equal(JSON.stringify(grouped),JSON.stringify([{category:'VIEWING',total:2,completed:1}]));
console.log('PASS: editable follow-up suggestions and scoped Riyadh-day category counts');

const references={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/documents/brokerage-reference.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:references});
for(const ref of [undefined,null,'','   ','/docs/sample_brokerage.pdf',' /docs/sample_brokerage.pdf?old=1#page=1 '])assert.equal(references.brokerageAttachmentReference(ref),undefined);
assert.equal(references.brokerageAttachmentReference('/private/actual.pdf'),'/private/actual.pdf');
console.log('PASS: absent and historical sample references are not presented as signed attachments');
