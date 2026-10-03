// Read-only: evaluate the checked-in legacy seed definitions with a stub client.
// Output contains only counts/field names; no private records or credentials.
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const { execFileSync } = require('child_process');
const source = execFileSync('git', ['show', '85dd459:lib/supabaseClient.ts'], { encoding: 'utf8' });
const context = {exports:{},require:()=>({createClient:()=>({})}),process:{env:{}},Date};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
const backup = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data;
const seeds = Object.values(context.exports).filter(Array.isArray).flat();
for (const [key, raw] of Object.entries(backup)) {
 const rows = JSON.parse(raw);
 if (!Array.isArray(rows) || key === 'kohl_deleted_ids_v1') continue;
 let exact=0, absent=0; const changed=[];
 for(const row of rows){
  const seed=seeds.find(s=>s.id===row.id);
  if(!seed){absent++;continue;}
  const fields=[...new Set([...Object.keys(seed),...Object.keys(row)])]
   .filter(k=>JSON.stringify(seed[k])!==JSON.stringify(row[k]));
  if(!fields.length) exact++; else changed.push(fields);
 }
 console.log(JSON.stringify({key,count:rows.length,exact_seed:exact,non_seed:absent,changed_seed_fields:changed}));
}
