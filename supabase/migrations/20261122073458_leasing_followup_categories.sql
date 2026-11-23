-- Structured follow-up categories; legacy tasks remain GENERAL rather than guessed.
begin;
alter table portal_private.leasing_followups add column category text not null default 'GENERAL'
 check(category in ('GENERAL','CONTACT','QUALIFY','OPTIONS','VIEWING','CONTRACT','ARRIVAL','DEPARTURE','RENEWAL','READINESS','COLLECTION'));
do $$
declare signature text; source text; old_keys text:='when ''FOLLOWUP_ADD'' then array[''id'',''case_id'',''title'',''due_at'']';
 old_insert text:='insert into portal_private.leasing_followups(id,case_id,assignee_id,title,due_at) values(target,cid,c.assignee_id,btrim(payload->>''title''),(payload->>''due_at'')::timestamptz);';
begin
 foreach signature in array array['portal_private.operations_core_v1(text,jsonb)','portal_private.leasing_core_v1(text,jsonb)'] loop
  source:=pg_get_functiondef(signature::regprocedure);
  if (length(source)-length(replace(source,old_keys,'')))/length(old_keys)<>1
   or (length(source)-length(replace(source,old_insert,'')))/length(old_insert)<>1 then
   raise exception 'Unexpected follow-up implementation';
  end if;
  source:=replace(source,old_keys,'when ''FOLLOWUP_ADD'' then array[''id'',''case_id'',''title'',''due_at'',''category'']');
  source:=replace(source,old_insert,'insert into portal_private.leasing_followups(id,case_id,assignee_id,title,due_at,category) values(target,cid,c.assignee_id,btrim(payload->>''title''),(payload->>''due_at'')::timestamptz,coalesce(payload->>''category'',''GENERAL''));');
  execute source;
 end loop;
end $$;
notify pgrst,'reload schema';
commit;
