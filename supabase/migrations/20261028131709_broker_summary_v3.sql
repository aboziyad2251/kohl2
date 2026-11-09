-- The two-page summary replaces eight-page KC-M issuance; old snapshots are retained.
begin;
set local lock_timeout='5s';
alter function public.issue_standard_form(uuid,jsonb) set schema portal_private;
alter function portal_private.issue_standard_form(uuid,jsonb) rename to issue_standard_form_pre_summary;
revoke all on function portal_private.issue_standard_form_pre_summary(uuid,jsonb) from public,anon,authenticated,service_role;
create function portal_private.issue_current_standard_form(request_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or not (portal_private.is_executive() or portal_private.has_role('EMPLOYEE')) then raise exception 'Operational staff only' using errcode='42501'; end if;
 if payload->>'kind'='KC-M' then raise exception 'Use the current two-page broker summary' using errcode='22023'; end if;
 return portal_private.issue_standard_form_pre_summary(request_id,payload);
end $$;
revoke all on function portal_private.issue_current_standard_form(uuid,jsonb) from public,anon;
grant execute on function portal_private.issue_current_standard_form(uuid,jsonb) to authenticated;
create function public.issue_standard_form(request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select portal_private.issue_current_standard_form(request_id,payload) $$;
revoke all on function public.issue_standard_form(uuid,jsonb) from public,anon;
grant execute on function public.issue_standard_form(uuid,jsonb) to authenticated;

create function portal_private.issue_broker_summary(request_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v jsonb; prior portal_private.bill_forms; seq bigint; num text; y integer; key text; entry record; d date; begin
 if auth.uid() is null or not (portal_private.is_executive() or portal_private.has_role('EMPLOYEE')) then raise exception 'Operational staff only' using errcode='42501'; end if;
 if request_id is null or octet_length(payload::text)>16000 or jsonb_typeof(payload) is distinct from 'object' or payload->>'kind' is distinct from 'KC-M' or jsonb_typeof(payload->'values') is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload) k where k not in ('kind','date','values')) then raise exception 'Invalid summary' using errcode='22023'; end if;
 v:=payload->'values';
 for key in select jsonb_object_keys(v) loop
  if key not in ('agreement_number','representative','broker_name','broker_national_id','fal_number','fal_expiry','mobile','vehicle','start_date','end_date','broker_share','penalty_amount','prepared_date','acknowledged_name','acknowledged_date','approved_date','checks') then raise exception 'Unknown summary field' using errcode='22023'; end if;
 end loop;
 for entry in select * from jsonb_each_text('{"agreement_number":20,"representative":60,"broker_name":60,"broker_national_id":10,"fal_number":20,"fal_expiry":10,"mobile":10,"vehicle":35,"start_date":10,"end_date":10,"prepared_date":10,"acknowledged_name":60,"acknowledged_date":10,"approved_date":10}'::jsonb) loop
  if jsonb_typeof(v->entry.key) is distinct from 'string' or length(v->>entry.key)>entry.value::integer then raise exception 'Invalid field' using errcode='22023'; end if;
 end loop;
 if length(btrim(v->>'agreement_number'))=0 or length(btrim(v->>'broker_name'))<3 or length(btrim(v->>'representative'))<2 or v->>'broker_national_id' !~ '^1[0-9]{9}$' or v->>'mobile' !~ '^05[0-9]{8}$' or v->>'fal_number' !~ '^[0-9]{5,20}$' then raise exception 'Missing identity details' using errcode='22023'; end if;
 for key in select unnest(array['date','start_date','end_date','fal_expiry','prepared_date','acknowledged_date','approved_date']) loop
  if key='date' then d:=(payload->>'date')::date;
  elsif v->>key='' and key in ('prepared_date','acknowledged_date','approved_date') then continue;
  else d:=(v->>key)::date;end if;
  if d is null or extract(year from d) not between 2000 and 2099 or to_char(d,'YYYY-MM-DD') is distinct from (case when key='date' then payload->>'date' else v->>key end) then raise exception 'Invalid date' using errcode='22023'; end if;
 end loop;
 if v->>'end_date'<v->>'start_date' or v->>'fal_expiry'<v->>'end_date' then raise exception 'Invalid agreement/license period' using errcode='22023'; end if;
 if jsonb_typeof(v->'broker_share') is distinct from 'number' or jsonb_typeof(v->'penalty_amount') is distinct from 'number' or (v->>'broker_share')::numeric not between 0 and 100 or (v->>'penalty_amount')::numeric not between 0 and 99999999.99 or trunc((v->>'broker_share')::numeric,2)<>(v->>'broker_share')::numeric or trunc((v->>'penalty_amount')::numeric,2)<>(v->>'penalty_amount')::numeric then raise exception 'Invalid amount/share' using errcode='22023'; end if;
 if jsonb_typeof(v->'checks') is distinct from 'object' or (select count(*) from jsonb_object_keys(v->'checks'))<>6 then raise exception 'Invalid checklist' using errcode='22023'; end if;
 foreach key in array array['raci','disclosures','trial','license_register','agreement_archive','penalty_authorized'] loop if jsonb_typeof(v->'checks'->key) is distinct from 'boolean' then raise exception 'Invalid checklist value' using errcode='22023'; end if; end loop;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into prior from portal_private.bill_forms f where f.id=request_id;
 if found then
  if prior.actor<>auth.uid() then raise exception 'Not your request' using errcode='42501'; end if;
  if prior.snapshot->'form' is distinct from payload or prior.snapshot->>'templateVersion'<>'3' then raise exception 'Retry content changed' using errcode='40001'; end if;
  return jsonb_build_object('number',prior.number,'form',payload,'createdAt',prior.created_at);
 end if;
 y:=extract(year from (payload->>'date')::date);
 insert into portal_private.bill_counters(kind,year,last_value) values('KC-M',y,1) on conflict(kind,year) do update set last_value=portal_private.bill_counters.last_value+1 returning last_value into seq;
 num:='KC-M-'||y::text||'-'||case when seq<100000 then lpad(seq::text,5,'0') else seq::text end;
 insert into portal_private.bill_forms(id,actor,number,snapshot) values(request_id,auth.uid(),num,jsonb_build_object('form',payload,'templateVersion',3)) returning * into prior;
 return jsonb_build_object('number',num,'form',payload,'createdAt',prior.created_at);
end $$;
revoke all on function portal_private.issue_broker_summary(uuid,jsonb) from public,anon;
grant execute on function portal_private.issue_broker_summary(uuid,jsonb) to authenticated;
create function public.issue_broker_summary(request_id uuid,payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select portal_private.issue_broker_summary(request_id,payload) $$;
revoke all on function public.issue_broker_summary(uuid,jsonb) from public,anon;
grant execute on function public.issue_broker_summary(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
