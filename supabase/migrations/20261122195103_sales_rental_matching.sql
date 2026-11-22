begin;
create table portal_private.market_requests(
 request_id uuid primary key references public.customer_orders(id) on delete cascade,
 details jsonb not null, updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now()
);
create table portal_private.market_listings(
 id uuid primary key,property_id uuid not null references public.properties(id) on delete cascade, purpose text not null check(purpose in ('SALE','RENT')),
 details jsonb not null,updated_by uuid not null references auth.users(id),updated_at timestamptz not null default now(),unit_key text generated always as (coalesce(details->>'unit_id','')) stored,unique(property_id,purpose,unit_key)
);
create table portal_private.market_feedback(
 id uuid primary key,request_id uuid not null references public.customer_orders(id) on delete cascade,property_id uuid not null references public.properties(id) on delete cascade,
 stage text not null check(stage in ('CONTACTED','VIEWING','OFFER','WON','REJECTED')),reason text not null check(length(reason)<=500),
 actor uuid not null references auth.users(id),created_at timestamptz not null default now(),check(stage<>'REJECTED' or length(btrim(reason))>0)
);
alter table portal_private.market_requests enable row level security;
alter table portal_private.market_listings enable row level security;
alter table portal_private.market_feedback enable row level security;
revoke all on portal_private.market_requests,portal_private.market_listings,portal_private.market_feedback from public,anon,authenticated,service_role;
create function public.market_workspace(operation text,payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); d jsonb; k text; target uuid; unit uuid; result jsonb;
begin
 if not exists(select 1 from portal_private.accounts a where a.user_id=who and a.is_active and a.role in ('ADMIN','CEO','EMPLOYEE')) then raise exception 'Not authorized' using errcode='42501'; end if;
 if operation='LOAD' then
  if (select count(*) from public.properties)>2000 or (select count(*) from public.customer_orders)>2000 then raise exception 'Catalog requires pagination' using errcode='54000'; end if;
  return jsonb_build_object(
   'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'title',p.property_name,'city',p.city,'address',p.address,'occupancy',case
    when exists(select 1 from public.contracts c where c.property_id=p.id and lower(btrim(c.status))='active' and c.start_date<=(now() at time zone 'Asia/Riyadh')::date and c.end_date>(now() at time zone 'Asia/Riyadh')::date) then 'CONTRACTED'
    when exists(select 1 from public.contracts c where (c.property_id=p.id or c.property_id is null) and (c.status is null or lower(btrim(c.status)) not in ('draft','expired','terminated')) and (c.property_id is null or c.start_date is null or c.end_date is null or lower(btrim(c.status))<>'active')) then 'REVIEW'
    else 'NO_ACTIVE_CONTRACT' end)) from public.properties p),'[]'),
   'requests',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.customer_name,'number',o.order_number,'notes',o.notes,'status',o.status)) from public.customer_orders o),'[]'),
   'units',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'property_id',u.property_id,'code',u.code)) from portal_private.leasing_units u),'[]'),
   'request_profiles',coalesce((select jsonb_agg(to_jsonb(r)) from portal_private.market_requests r),'[]'),
   'listings',coalesce((select jsonb_agg(to_jsonb(l)) from portal_private.market_listings l),'[]'),
   'feedback',coalesce((select jsonb_agg(to_jsonb(f)) from portal_private.market_feedback f),'[]'));
 elsif operation in ('REQUEST','LISTING') then
  target:=(payload->>'id')::uuid;d:=payload->'details';
  if jsonb_typeof(d) is distinct from 'object' or pg_column_size(d)>5000 then raise exception 'Invalid profile';end if;
  if not (d ?& array['purpose','period','city','district','kind','rooms','entrances','area','price','budget','from','to','unit_id','hard','status'])
   or exists(select 1 from jsonb_object_keys(d) v where v not in ('purpose','period','city','district','kind','rooms','entrances','area','price','budget','from','to','unit_id','hard','status'))
   or (d->>'purpose') is null or d->>'purpose' not in ('SALE','RENT') or (d->>'status') is null or d->>'status' not in ('ACTIVE','PAUSED','CLOSED') then raise exception 'Invalid fields';end if;
  if d->>'purpose'='RENT' and (d->>'period' is null or d->>'period' not in ('DAILY','MONTHLY','ANNUAL')) then raise exception 'Rental period required';end if;
  foreach k in array array['city','district','kind','from','to'] loop
   if jsonb_typeof(d->k) is distinct from 'string' or length(d->>k)>100 then raise exception 'Invalid text';end if;
  end loop;
  foreach k in array array['rooms','entrances','area','price','budget'] loop
   if d->k<>'null'::jsonb and (jsonb_typeof(d->k)<>'number' or (d->>k)::numeric<=0 or (d->>k)::numeric>999999999) then raise exception 'Invalid number';end if;
  end loop;
  foreach k in array array['rooms','entrances'] loop
   if d->k<>'null'::jsonb and ((d->>k)::numeric>100 or trunc((d->>k)::numeric)<>(d->>k)::numeric) then raise exception 'Invalid count';end if;
  end loop;
  if d->>'from'<>'' or d->>'to'<>'' then
   if d->>'from' !~ '^\d{4}-\d{2}-\d{2}$' or d->>'to' !~ '^\d{4}-\d{2}-\d{2}$' or (d->>'from')::date >= (d->>'to')::date then raise exception 'Invalid dates';end if;
  end if;
  if jsonb_typeof(d->'hard') is distinct from 'array' or jsonb_array_length(d->'hard')>7 then raise exception 'Invalid requirements';end if;
  if exists(select 1 from jsonb_array_elements_text(d->'hard') v where v not in ('budget','city','district','kind','rooms','entrances','area')) then raise exception 'Invalid requirements';end if;
  if operation='REQUEST' then
   if exists(select 1 from jsonb_array_elements_text(d->'hard') v where d->v='null'::jsonb or d->>v='') then raise exception 'Required value missing';end if;
   insert into portal_private.market_requests values(target,d,who,now()) on conflict(request_id) do update set details=excluded.details,updated_by=who,updated_at=now();
  else
   unit:=(d->>'unit_id')::uuid;
   if unit is not null and not exists(select 1 from portal_private.leasing_units where id=unit and property_id=target) then raise exception 'Unit/property mismatch';end if;
   if exists(select 1 from portal_private.market_listings where id=(payload->>'listing_id')::uuid and (property_id<>target or purpose<>d->>'purpose')) then raise exception 'Listing identity mismatch';end if;
   insert into portal_private.market_listings(id,property_id,purpose,details,updated_by,updated_at) values((payload->>'listing_id')::uuid,target,d->>'purpose',d,who,now()) on conflict(id) do update set details=excluded.details,updated_by=who,updated_at=now();
  end if;
 elsif operation='FEEDBACK' then
  if exists(select 1 from portal_private.market_feedback f where f.id=(payload->>'id')::uuid and (f.actor<>who or f.request_id<>(payload->>'request_id')::uuid or f.property_id<>(payload->>'property_id')::uuid or f.stage<>payload->>'stage' or f.reason<>payload->>'reason')) then raise exception 'Retry payload differs';end if;
  insert into portal_private.market_feedback(id,request_id,property_id,stage,reason,actor) values((payload->>'id')::uuid,(payload->>'request_id')::uuid,(payload->>'property_id')::uuid,payload->>'stage',payload->>'reason',who) on conflict(id) do nothing;
 else raise exception 'Unknown operation';end if;
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.market_workspace(text,jsonb) from public,anon,service_role;
grant execute on function public.market_workspace(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
