// Regenerates the pending SQL field whitelist without running a migration.
const fs=require('node:fs'),{load}=require('./load-standard-model.cjs');
const {templates,fieldLimit}=load('lib/forms/templates.ts');
const manifest=Object.fromEntries(templates.map(t=>[t.code,Object.fromEntries(t.fields.filter(f=>!f.computed).map(f=>[f.key,{type:f.type||'text',max:fieldLimit(f),required:!!f.required,...(f.options?{options:f.options}:{})}]))]));
const p='supabase/migrations/20261009235815_standard_forms.sql';
const sql=fs.readFileSync(p,'utf8').replace(/defs jsonb := '[^\n]*'::jsonb;/,'defs jsonb := '+"'"+JSON.stringify(manifest).replaceAll("'","''")+"'::jsonb;");
fs.writeFileSync(p,sql);console.log('Pending migration whitelist regenerated; no SQL executed');
