-- PROPOSED ONLY: requires approval and live schema inspection before applying.
begin;
create table portal_private.bill_counters(kind text not null, year integer not null, last_value bigint not null, primary key(kind,year));
create table portal_private.bill_forms(
 id uuid primary key, actor uuid not null references auth.users(id), number text not null unique,
 snapshot jsonb not null, created_at timestamptz not null default now()
);
alter table portal_private.bill_forms enable row level security;
alter table portal_private.bill_counters enable row level security;
revoke all on portal_private.bill_forms,portal_private.bill_counters from public,anon,authenticated;
create function public.issue_bill_form(request_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare role_name text; k text; y integer; seq bigint; num text; saved portal_private.bill_forms; net bigint; tax bigint;
begin
 select role into role_name from portal_private.accounts where user_id=auth.uid() and is_active;
 if role_name is null or role_name not in ('ADMIN','CEO','EMPLOYEE') then raise exception 'Operational staff only' using errcode='42501'; end if;
 -- Serialize repeated request IDs, including retries after a lost response.
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into saved from portal_private.bill_forms where id=request_id;
 if found then
  if saved.actor<>auth.uid() then raise exception 'Request not accessible' using errcode='42501'; end if;
  if saved.snapshot->'form'<>payload then raise exception 'Retry payload changed'; end if;
  return jsonb_build_object('number',saved.number,'form',saved.snapshot->'form','createdAt',saved.created_at);
 end if;
 k=payload->>'kind'; y=extract(year from (payload->>'date')::date);
 if k not in ('REC','VOU','INV','HND') or k is null or y not between 1900 and 2200
 or coalesce(payload->>'amount','') !~ '^\d{1,9}(\.\d{1,2})?$'
 or length(trim(coalesce(payload->>'party',''))) not between 1 and 150
 or length(trim(coalesce(payload->>'unit',''))) not between 1 and 150
 or coalesce(payload->>'method','') not in ('نقداً','تحويل بنكي','شيك','مدى','رابط دفع')
 or coalesce(payload->>'invoiceType','') not in ('rent','sale')
 or coalesce(payload->>'nature','') not in ('إيراد للمكتب','أمانة طرف ثالث')
 or jsonb_typeof(payload->'vat') is distinct from 'boolean'
 or length(coalesce(payload->>'notes',''))>1200 or length(coalesce(payload->>'condition',''))>1200
 or length(coalesce(payload->>'reference',''))>150 or length(coalesce(payload->>'bank',''))>150
 or length(coalesce(payload->>'iban',''))>34 or length(coalesce(payload->>'keys',''))>100
 then raise exception 'Invalid document'; end if;
 if (payload->>'vat')::boolean and (k<>'INV' or payload->>'nature'='أمانة طرف ثالث') then raise exception 'Invalid tax'; end if;
 if payload ? 'override' then
  if role_name not in ('ADMIN','CEO') then raise exception 'Executive required' using errcode='42501'; end if;
  num=payload->>'override';
  if num is null or num !~ ('^'||k||'-'||y::text||'-[0-9]{5,9}$') then raise exception 'Invalid number'; end if;
  seq=split_part(num,'-',3)::bigint;
  if seq<1 then raise exception 'Invalid sequence'; end if;
  insert into portal_private.bill_counters values(k,y,seq) on conflict(kind,year) do update set last_value=greatest(portal_private.bill_counters.last_value,excluded.last_value);
 else
  insert into portal_private.bill_counters values(k,y,1) on conflict(kind,year) do update set last_value=portal_private.bill_counters.last_value+1 returning last_value into seq;
  num=k||'-'||y::text||'-'||case when seq<100000 then lpad(seq::text,5,'0') else seq::text end;
 end if;
 net=round((payload->>'amount')::numeric*100); tax=case when (payload->>'vat')::boolean then round(net*15::numeric/100) else 0 end;
 insert into portal_private.bill_forms(id,actor,number,snapshot) values(request_id,auth.uid(),num,jsonb_build_object('form',payload,'net',net,'tax',tax,'total',net+tax,'templateVersion',1)) returning * into saved;
 return jsonb_build_object('number',saved.number,'form',payload,'createdAt',saved.created_at);
end $$;
revoke all on function public.issue_bill_form(uuid,jsonb) from public,anon;
grant execute on function public.issue_bill_form(uuid,jsonb) to authenticated;
commit;
