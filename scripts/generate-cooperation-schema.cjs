// Generate only the new additive migration; never rewrite applied migrations.
const fs=require('node:fs'),{load}=require('./load-standard-model.cjs');
const {templates,fieldLimit}=load('lib/forms/templates.ts');
const defs=Object.fromEntries(templates.map(t=>[t.code,Object.fromEntries(t.fields.filter(f=>!f.computed).map(f=>[f.key,{type:f.type||'text',max:fieldLimit(f),required:!!f.required,...(f.options?{options:f.options}:{})}]))]));
let sql=fs.readFileSync('supabase/migrations/20261009235815_standard_forms.sql','utf8')
 .replace('create function public.issue_standard_form','create or replace function public.issue_standard_form')
 .replace(/defs jsonb := '[^\n]*'::jsonb;/,"defs jsonb := '"+JSON.stringify(defs).replaceAll("'","''")+"'::jsonb;");
sql=sql.replace(" if k='KC-B'", " if k='KC-M' and (v->>'brokerShare')::numeric>100 then raise exception 'Invalid broker share' using errcode='22023'; end if;\n if k='KC-B'");
fs.writeFileSync('supabase/migrations/20261010174132_broker_cooperation_form.sql',sql);
console.log('New cooperation whitelist generated; applied migrations unchanged');
