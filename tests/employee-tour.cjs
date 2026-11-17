const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('node:assert/strict');
function load(path,mocks={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>mocks[name]||require(name)});return exports;}
const nav=load('lib/navigation.ts'),tour=load('lib/onboarding/tour.ts',{'@/lib/navigation':nav});
for(const allowed of [[],['leasing'],['dashboard','employees','archive'],['crm','contracts','ownership-properties','internal-finance']]) {
 const steps=tour.tourSteps(key=>allowed.includes(key));assert(steps.length>=24);assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);
 for(const step of steps.filter(s=>s.href))assert(allowed.includes(nav.navItems.find(n=>n.href===step.href).moduleKey));
}
assert.notEqual(tour.tourStorageKey('a'),tour.tourStorageKey('b'));
console.log('PASS: at least 24 steps for all permission sets, no unauthorized destinations, per-user persistence');
