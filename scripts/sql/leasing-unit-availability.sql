-- Isolated candidate only. Requires the cancellation candidate and existing leasing schema.
-- No automatic mapping of historical contracts from text labels.
begin;
create table portal_private.leasing_contract_units (
 contract_id uuid primary key references public.contracts(id),
 unit_id uuid not null references portal_private.leasing_units(id),
 linked_by uuid not null references portal_private.accounts(user_id),
 linked_at timestamptz not null default now()
);
alter table portal_private.leasing_contract_units enable row level security;
revoke all on portal_private.leasing_contract_units from public,anon,authenticated,service_role;

-- One immutable initial deadline per case. Notes cannot renew a reservation.
create table portal_private.leasing_holds (
 case_id uuid primary key references portal_private.leasing_cases(id),
 unit_id uuid not null references portal_private.leasing_units(id),
 start_date date not null,
 end_date date not null check(end_date>start_date),
 created_at timestamptz not null,
 expires_at timestamptz not null check(expires_at>created_at),
 created_by uuid not null references portal_private.accounts(user_id),
 extended_by uuid references portal_private.accounts(user_id),
 extension_reason text,
 check(expires_at<=created_at+interval '72 hours')
);
create index leasing_holds_unit_period on portal_private.leasing_holds(unit_id,start_date,end_date);
alter table portal_private.leasing_holds enable row level security;
revoke all on portal_private.leasing_holds from public,anon,authenticated,service_role;

-- Apartment attributes are explicit; never inherit building-wide room counts.
create table portal_private.leasing_unit_specs (
 unit_id uuid primary key references portal_private.leasing_units(id),
 bedrooms integer check(bedrooms between 1 and 100),
 entrances integer check(entrances between 1 and 20),
 updated_by uuid not null references portal_private.accounts(user_id),
 updated_at timestamptz not null default now()
);
alter table portal_private.leasing_unit_specs enable row level security;
revoke all on portal_private.leasing_unit_specs from public,anon,authenticated,service_role;

create function public.save_leasing_unit_specs(target_unit uuid,room_count integer,entrance_count integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
 if not exists(select 1 from portal_private.accounts where user_id=who and is_active and role in ('ADMIN','CEO')) then raise insufficient_privilege; end if;
 if (room_count is not null and room_count not between 1 and 100)
  or (entrance_count is not null and entrance_count not between 1 and 20) then raise invalid_parameter_value; end if;
 perform 1 from portal_private.leasing_units where id=target_unit for update;
 if not found then raise no_data_found; end if;
 insert into portal_private.leasing_unit_specs(unit_id,bedrooms,entrances,updated_by)
 values(target_unit,room_count,entrance_count,who)
 on conflict(unit_id) do update set bedrooms=excluded.bedrooms,entrances=excluded.entrances,updated_by=who,updated_at=now();
 insert into portal_private.operations_history(entity_id,actor,action,note,changes)
 values(target_unit,who,'UNIT_SPECS_SAVE','تحديث مواصفات الوحدة',jsonb_build_object('bedrooms',room_count,'entrances',entrance_count));
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.save_leasing_unit_specs(uuid,integer,integer) from public,anon,service_role;
grant execute on function public.save_leasing_unit_specs(uuid,integer,integer) to authenticated;

create function public.leasing_unit_availability(from_date date,to_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare acct portal_private.accounts; result jsonb;
begin
 select * into acct from portal_private.accounts where user_id=auth.uid() and is_active;
 if not found or acct.role not in ('ADMIN','CEO','EMPLOYEE','LEASING') then raise insufficient_privilege; end if;
 if acct.role='LEASING' then perform portal_private.leasing_scope(); end if;
 if from_date is null or to_date is null or to_date<=from_date or from_date<date '2000-01-01' or to_date>date '2100-01-01' then raise invalid_parameter_value; end if;
 -- Fail closed when old contracts cannot yet be assigned to a precise apartment.
 with state as (
 select u.id,u.property_id,u.code,u.readiness,spec.bedrooms,spec.entrances,
 exists(select 1 from public.contracts c where c.property_id=u.property_id and c.status='Active'
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<to_date and c.end_date>from_date))
  and not exists(select 1 from portal_private.leasing_contract_units l join portal_private.leasing_units target on target.id=l.unit_id
   where l.contract_id=c.id and target.property_id=c.property_id)) as needs_mapping,
 exists(select 1 from portal_private.leasing_contract_units l join public.contracts c on c.id=l.contract_id
  where l.unit_id=u.id and c.status='Active'
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<to_date and c.end_date>from_date))) as contracted,
 exists(select 1 from portal_private.leasing_cases c where c.unit_id=u.id and c.stage='CONFIRMED'
  and c.booking_cancelled_at is null and c.start_date<to_date and c.end_date>from_date) as booked,
 exists(select 1 from portal_private.leasing_holds h join portal_private.leasing_cases c on c.id=h.case_id
  where h.unit_id=u.id and h.expires_at>statement_timestamp() and c.booking_cancelled_at is null
  and c.stage not in ('CONFIRMED','CANCELLED','LOST') and h.start_date<to_date and h.end_date>from_date) as held
 from portal_private.leasing_units u left join portal_private.leasing_unit_specs spec on spec.unit_id=u.id)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'property_id',property_id,'code',code,'readiness',readiness,'bedrooms',bedrooms,'entrances',entrances,
  'available',readiness='READY' and not needs_mapping and not contracted and not booked and not held,
  'reason',case when needs_mapping then 'CONTRACT_MAPPING_REQUIRED' when contracted then 'CONTRACTED'
   when held then 'HELD' when booked then 'BOOKED' when readiness<>'READY' then 'NOT_READY' else 'AVAILABLE' end) order by code,id),'[]'::jsonb)
 into result from state;
 return jsonb_build_object('from',from_date,'to',to_date,'units',result);
end $$;
revoke all on function public.leasing_unit_availability(date,date) from public,anon,service_role;
grant execute on function public.leasing_unit_availability(date,date) to authenticated;

create function public.link_leasing_contract_unit(target_contract uuid,target_unit uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); c public.contracts; u portal_private.leasing_units; existing uuid;
begin
 if not exists(select 1 from portal_private.accounts where user_id=who and is_active and role in ('ADMIN','CEO')) then raise insufficient_privilege; end if;
 select * into c from public.contracts where id=target_contract for update;
 if not found then raise no_data_found; end if;
 select * into u from portal_private.leasing_units where id=target_unit for update;
 if not found then raise no_data_found; end if;
 if c.property_id is distinct from u.property_id then raise exception 'Contract and unit properties differ' using errcode='22023'; end if;
 select unit_id into existing from portal_private.leasing_contract_units where contract_id=c.id;
 if found then
  if existing<>u.id then raise exception 'Existing mapping requires reviewed correction' using errcode='PT409'; end if;
  return jsonb_build_object('saved',true,'already_linked',true);
 end if;
 if c.status='Active' then
  if c.start_date is null or c.end_date is null or c.end_date<=c.start_date then raise invalid_parameter_value; end if;
  if exists(select 1 from portal_private.leasing_contract_units l join public.contracts other on other.id=l.contract_id
   where l.unit_id=u.id and other.status='Active' and (other.start_date is null or other.end_date is null
    or other.end_date<=other.start_date or (other.start_date<c.end_date and other.end_date>c.start_date))) then
   raise exception 'Overlapping active contract' using errcode='PT409';
  end if;
  if exists(select 1 from portal_private.leasing_cases lc where lc.unit_id=u.id and lc.contract_id is distinct from c.id
   and lc.stage='CONFIRMED' and lc.booking_cancelled_at is null and lc.start_date<c.end_date and lc.end_date>c.start_date)
  or exists(select 1 from portal_private.leasing_holds h join portal_private.leasing_cases lc on lc.id=h.case_id
   where h.unit_id=u.id and h.expires_at>clock_timestamp() and lc.booking_cancelled_at is null
   and lc.stage not in ('CONFIRMED','CANCELLED','LOST') and h.start_date<c.end_date and h.end_date>c.start_date
   and not (lc.contract_id is not distinct from c.id and h.start_date=c.start_date and h.end_date=c.end_date)) then
   raise exception 'Contract mapping conflicts with occupancy' using errcode='PT409';
  end if;

 end if;
 insert into portal_private.leasing_contract_units(contract_id,unit_id,linked_by) values(c.id,u.id,who);
 insert into portal_private.operations_history(entity_id,actor,action,note,changes)
 values(c.id,who,'CONTRACT_UNIT_LINK','ربط عقد بوحدة',jsonb_build_object('unit_id',u.id,'property_id',u.property_id));
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.link_leasing_contract_unit(uuid,uuid) from public,anon,service_role;
grant execute on function public.link_leasing_contract_unit(uuid,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
