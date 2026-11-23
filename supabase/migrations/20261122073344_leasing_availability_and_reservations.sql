-- Period-aware apartment occupancy. No automatic historical contract mapping.
-- Atomic migration; requires the deployed leasing specialist and approval schemas.
begin;

-- Source: leasing-booking-cancellation.sql
alter table portal_private.leasing_cases
 add column booking_cancelled_at timestamptz,
 add column booking_cancelled_by uuid references portal_private.accounts(user_id);
create function public.cancel_leasing_booking(case_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); acct portal_private.accounts; cfg portal_private.operations_approval_config;
 old_case portal_private.leasing_cases;
begin
 select * into acct from portal_private.accounts where user_id=who and is_active for share;
 if not found then raise insufficient_privilege; end if;
 select * into cfg from portal_private.operations_approval_config where singleton for share;
 if not found or not ((who=cfg.manager_id and acct.role='ADMIN') or (who=cfg.final_id and acct.role='CEO')) then
  raise insufficient_privilege;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(case_id::text,0));
 select * into old_case from portal_private.leasing_cases where id=case_id for update;
 if not found then raise no_data_found; end if;
 if old_case.booking_cancelled_at is not null then return jsonb_build_object('saved',true,'already_cancelled',true); end if;
 update portal_private.leasing_cases set booking_cancelled_at=now(),booking_cancelled_by=who,
  version=version+1,updated_at=now() where id=case_id;
 insert into portal_private.operations_history(entity_id,case_id,actor,action,note,changes)
 values(case_id,case_id,who,'BOOKING_CANCEL','إلغاء الحجز',jsonb_build_object('previous_stage',old_case.stage,'contract_retained',old_case.contract_id is not null));
 return jsonb_build_object('saved',true);
end $$;
revoke all on function public.cancel_leasing_booking(uuid) from public,anon,service_role;
grant execute on function public.cancel_leasing_booking(uuid) to authenticated;
notify pgrst,'reload schema';

-- Source: leasing-unit-availability.sql
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
 exists(select 1 from public.contracts c where c.property_id=u.property_id
  and (c.status is null or lower(btrim(c.status)) not in ('active','draft','expired','terminated'))
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<to_date and c.end_date>from_date))) as needs_status_review,
 exists(select 1 from public.contracts c where c.property_id=u.property_id and lower(btrim(c.status))='active'
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<to_date and c.end_date>from_date))
  and not exists(select 1 from portal_private.leasing_contract_units l join portal_private.leasing_units target on target.id=l.unit_id
   where l.contract_id=c.id and target.property_id=c.property_id)) as needs_mapping,
 exists(select 1 from portal_private.leasing_contract_units l join public.contracts c on c.id=l.contract_id
  where l.unit_id=u.id and lower(btrim(c.status))='active'
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<to_date and c.end_date>from_date))) as contracted,
 exists(select 1 from portal_private.leasing_cases c where c.unit_id=u.id and c.stage='CONFIRMED'
  and c.booking_cancelled_at is null and c.start_date<to_date and c.end_date>from_date) as booked,
 exists(select 1 from portal_private.leasing_holds h join portal_private.leasing_cases c on c.id=h.case_id
  where h.unit_id=u.id and h.expires_at>statement_timestamp() and c.booking_cancelled_at is null
  and c.stage not in ('CONFIRMED','CANCELLED','LOST') and h.start_date<to_date and h.end_date>from_date) as held
 from portal_private.leasing_units u left join portal_private.leasing_unit_specs spec on spec.unit_id=u.id)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'property_id',property_id,'code',code,'readiness',readiness,'bedrooms',bedrooms,'entrances',entrances,
  'available',readiness='READY' and not needs_status_review and not needs_mapping and not contracted and not booked and not held,
  'reason',case when needs_status_review then 'CONTRACT_STATUS_REVIEW' when needs_mapping then 'CONTRACT_MAPPING_REQUIRED' when contracted then 'CONTRACTED'
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
 if c.status is null or lower(btrim(c.status)) not in ('active','draft','expired','terminated') then raise exception 'Contract status needs review before mapping' using errcode='PT409'; end if;
 if c.property_id is distinct from u.property_id then raise exception 'Contract and unit properties differ' using errcode='22023'; end if;
 select unit_id into existing from portal_private.leasing_contract_units where contract_id=c.id;
 if found then
  if existing<>u.id then raise exception 'Existing mapping requires reviewed correction' using errcode='PT409'; end if;
  return jsonb_build_object('saved',true,'already_linked',true);
 end if;
 if lower(btrim(c.status))='active' then
  if c.start_date is null or c.end_date is null or c.end_date<=c.start_date then raise invalid_parameter_value; end if;
  if exists(select 1 from portal_private.leasing_contract_units l join public.contracts other on other.id=l.contract_id
   where l.unit_id=u.id and lower(btrim(other.status))='active' and (other.start_date is null or other.end_date is null
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

-- Source: leasing-temporary-holds.sql
create function public.reserve_leasing_unit(target_case uuid,target_unit uuid,from_date date,to_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); acct portal_private.accounts; c portal_private.leasing_cases;
 h portal_private.leasing_holds; operator_id uuid; checked_at timestamptz; hours integer; available boolean;
begin
 select * into acct from portal_private.accounts where user_id=who and is_active;
 if not found or acct.role not in ('ADMIN','CEO','EMPLOYEE','LEASING') then raise insufficient_privilege; end if;
 if acct.role='LEASING' then operator_id:=(portal_private.leasing_scope()).owner_id; end if;
 select * into c from portal_private.leasing_cases where id=target_case for update;
 if not found then raise no_data_found; end if;
 if acct.role in ('EMPLOYEE','LEASING') and c.assignee_id is distinct from who then raise insufficient_privilege; end if;
 if c.booking_cancelled_at is not null or c.stage in ('CONFIRMED','CANCELLED','LOST') then
  raise exception 'Case is not open for a hold' using errcode='PT409';
 end if;
 -- Case then unit is also the legacy confirmation lock order.
 perform 1 from portal_private.leasing_units where id=target_unit for update;
 if not found then raise no_data_found; end if;
 checked_at:=clock_timestamp();
 if from_date is null or to_date is null or to_date<=from_date
  or from_date<(checked_at at time zone 'Asia/Riyadh')::date or to_date>date '2100-01-01' then raise invalid_parameter_value; end if;
 select * into h from portal_private.leasing_holds where case_id=c.id;
 if found then
  if h.unit_id=target_unit and h.start_date=from_date and h.end_date=to_date and h.expires_at>checked_at then
   return jsonb_build_object('saved',true,'already_reserved',true,'expires_at',h.expires_at);
  end if;
  raise exception 'Existing hold cannot be silently replaced or renewed' using errcode='PT409';
 end if;
 select (item->>'available')::boolean into available
 from jsonb_array_elements(public.leasing_unit_availability(from_date,to_date)->'units') item
 where item->>'id'=target_unit::text;
 if available is distinct from true then raise exception 'Unit unavailable for requested period' using errcode='PT409'; end if;
 hours:=case c.kind when 'ANNUAL' then 72 when 'MONTHLY' then 24 when 'DAILY' then
  case when from_date<=(checked_at at time zone 'Asia/Riyadh')::date+1 then 2 else 12 end end;
 if hours is null then raise invalid_parameter_value; end if;
 insert into portal_private.leasing_holds(case_id,unit_id,start_date,end_date,created_at,expires_at,created_by)
 values(c.id,target_unit,from_date,to_date,checked_at,checked_at+make_interval(hours=>hours),who) returning * into h;
 insert into portal_private.operations_history(entity_id,case_id,actor,action,note,changes)
 values(c.id,c.id,who,'HOLD_CREATE','حجز مؤقت',jsonb_build_object('operator_id',operator_id,'unit_id',target_unit,'from',from_date,'to',to_date,'expires_at',h.expires_at));
 return jsonb_build_object('saved',true,'expires_at',h.expires_at);
end $$;
revoke all on function public.reserve_leasing_unit(uuid,uuid,date,date) from public,anon,service_role;
grant execute on function public.reserve_leasing_unit(uuid,uuid,date,date) to authenticated;

create function public.extend_leasing_hold(target_case uuid,reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); acct portal_private.accounts; cfg portal_private.operations_approval_config;
 c portal_private.leasing_cases; h portal_private.leasing_holds; checked_at timestamptz;
begin
 select * into acct from portal_private.accounts where user_id=who and is_active;
 if not found then raise insufficient_privilege; end if;
 select * into cfg from portal_private.operations_approval_config where singleton;
 if not found or not ((who=cfg.manager_id and acct.role='ADMIN') or (who=cfg.final_id and acct.role='CEO')) then raise insufficient_privilege; end if;
 if reason is null or length(btrim(reason)) not between 1 and 1000 then raise invalid_parameter_value; end if;
 select * into c from portal_private.leasing_cases where id=target_case for update;
 if not found then raise no_data_found; end if;
 select * into h from portal_private.leasing_holds where case_id=c.id for update;
 if not found then raise no_data_found; end if;
 perform 1 from portal_private.leasing_units where id=h.unit_id and readiness='READY' for update;
 if not found then raise exception 'Unit not ready' using errcode='PT409'; end if;
 checked_at:=clock_timestamp();
 if c.kind<>'MONTHLY' or c.booking_cancelled_at is not null or c.stage in ('CONFIRMED','CANCELLED','LOST')
  or h.expires_at<=checked_at or h.extended_by is not null then
  raise exception 'Hold cannot be extended' using errcode='PT409';
 end if;
 -- Recheck all occupancy after acquiring the unit lock; never revive an expired hold.
 if exists(select 1 from portal_private.leasing_holds other join portal_private.leasing_cases lc on lc.id=other.case_id
  where other.unit_id=h.unit_id and other.case_id<>c.id and other.expires_at>checked_at
  and lc.booking_cancelled_at is null and lc.stage not in ('CONFIRMED','CANCELLED','LOST')
  and other.start_date<h.end_date and other.end_date>h.start_date)
 or exists(select 1 from portal_private.leasing_cases lc where lc.unit_id=h.unit_id and lc.id<>c.id
  and lc.stage='CONFIRMED' and lc.booking_cancelled_at is null and lc.start_date<h.end_date and lc.end_date>h.start_date)
 or exists(select 1 from public.contracts ct where ct.property_id=(select property_id from portal_private.leasing_units where id=h.unit_id)
  and lower(btrim(ct.status))='active' and (ct.start_date is null or ct.end_date is null or ct.end_date<=ct.start_date or (ct.start_date<h.end_date and ct.end_date>h.start_date))
  and (not exists(select 1 from portal_private.leasing_contract_units l where l.contract_id=ct.id)
   or exists(select 1 from portal_private.leasing_contract_units l where l.contract_id=ct.id and l.unit_id=h.unit_id))) then
  raise exception 'Unit unavailable for extension' using errcode='PT409';
 end if;
 update portal_private.leasing_holds set expires_at=h.created_at+interval '72 hours',extended_by=who,extension_reason=btrim(reason)
 where case_id=c.id returning * into h;
 insert into portal_private.operations_history(entity_id,case_id,actor,action,note,changes)
 values(c.id,c.id,who,'HOLD_EXTEND',btrim(reason),jsonb_build_object('expires_at',h.expires_at));
 return jsonb_build_object('saved',true,'expires_at',h.expires_at);
end $$;
revoke all on function public.extend_leasing_hold(uuid,text) from public,anon,service_role;
grant execute on function public.extend_leasing_hold(uuid,text) to authenticated;
create function public.leasing_reservation_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare who uuid:=auth.uid(); acct portal_private.accounts; result jsonb;
begin
 select * into acct from portal_private.accounts where user_id=who and is_active;
 if not found or acct.role not in ('ADMIN','CEO','EMPLOYEE','LEASING') then raise insufficient_privilege; end if;
 if acct.role='LEASING' then perform portal_private.leasing_scope(); end if;
 select coalesce(jsonb_agg(jsonb_build_object('case_id',c.id,'unit_id',h.unit_id,'from',h.start_date,'to',h.end_date,
  'expires_at',h.expires_at,'extended',h.extended_by is not null,
  'status',case when c.booking_cancelled_at is not null or c.stage in ('CANCELLED','LOST') then 'CANCELLED'
   when c.stage='CONFIRMED' then 'CONFIRMED' when h.expires_at<=statement_timestamp() then 'EXPIRED' else 'ACTIVE' end)
  order by h.created_at desc),'[]'::jsonb) into result
 from portal_private.leasing_holds h join portal_private.leasing_cases c on c.id=h.case_id
 where acct.role in ('ADMIN','CEO') or c.assignee_id=who;
 return jsonb_build_object('server_now',statement_timestamp(),'reservations',result);
end $$;
revoke all on function public.leasing_reservation_status() from public,anon,service_role;
grant execute on function public.leasing_reservation_status() to authenticated;

-- Source: leasing-occupancy-guards.sql
create function portal_private.guard_leasing_confirmation() returns trigger
language plpgsql security definer set search_path='' as $$
declare ct public.contracts; cfg portal_private.operations_approval_config; acct portal_private.accounts;
begin
 if tg_op='UPDATE' then
  if old.stage='CANCELLED' and new.stage='CONFIRMED' then raise exception 'Cancelled booking cannot be confirmed' using errcode='PT409'; end if;
  if new.stage='CANCELLED' and old.stage is distinct from new.stage then
   select * into acct from portal_private.accounts where user_id=auth.uid() and is_active;
   select * into cfg from portal_private.operations_approval_config where singleton;
   if acct.user_id is null or cfg.manager_id is null or not
    ((acct.user_id=cfg.manager_id and acct.role='ADMIN') or (acct.user_id=cfg.final_id and acct.role='CEO')) then raise insufficient_privilege; end if;
  end if;
  -- Auditing or cancelling a historical confirmed case must not require backfilling it first.
  if (new.stage,new.unit_id,new.start_date,new.end_date,new.contract_id) is not distinct from
   (old.stage,old.unit_id,old.start_date,old.end_date,old.contract_id) then return new; end if;
 end if;
 if new.stage<>'CONFIRMED' then return new; end if;
 if new.booking_cancelled_at is not null then raise exception 'Cancelled booking cannot be confirmed' using errcode='PT409'; end if;
 perform 1 from portal_private.leasing_units where id=new.unit_id and readiness='READY' for update;
 if not found then raise exception 'Unit not ready' using errcode='PT409'; end if;
 select c.* into ct from public.contracts c join portal_private.leasing_contract_units l on l.contract_id=c.id
 where c.id=new.contract_id and l.unit_id=new.unit_id and lower(btrim(c.status))='active'
 and c.property_id=(select property_id from portal_private.leasing_units where id=new.unit_id)
 and c.start_date=new.start_date and c.end_date=new.end_date;
 if not found then raise exception 'Confirmation requires an active contract for this exact unit and period' using errcode='PT409'; end if;
 if exists(select 1 from portal_private.leasing_holds h join portal_private.leasing_cases c on c.id=h.case_id
  where h.unit_id=new.unit_id and h.case_id<>new.id and h.expires_at>clock_timestamp()
  and c.booking_cancelled_at is null and c.stage not in ('CONFIRMED','CANCELLED','LOST')
  and h.start_date<new.end_date and h.end_date>new.start_date)
 or exists(select 1 from portal_private.leasing_cases c where c.id<>new.id and c.unit_id=new.unit_id
  and c.stage='CONFIRMED' and c.booking_cancelled_at is null and c.start_date<new.end_date and c.end_date>new.start_date)
 or exists(select 1 from public.contracts c where c.id<>new.contract_id and c.property_id=ct.property_id and lower(btrim(c.status))='active'
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<new.end_date and c.end_date>new.start_date))
  and (not exists(select 1 from portal_private.leasing_contract_units l where l.contract_id=c.id)
   or exists(select 1 from portal_private.leasing_contract_units l where l.contract_id=c.id and l.unit_id=new.unit_id))) then
  raise exception 'Conflicting occupancy' using errcode='PT409';
 end if;
 return new;
end $$;
revoke all on function portal_private.guard_leasing_confirmation() from public,anon,authenticated,service_role;
create trigger leasing_confirmation_guard before insert or update on portal_private.leasing_cases
 for each row execute function portal_private.guard_leasing_confirmation();

create function portal_private.guard_mapped_contract() returns trigger
language plpgsql security definer set search_path='' as $$
declare unit uuid;
begin
 if tg_op='UPDATE' and (new.property_id,new.status,new.start_date,new.end_date) is not distinct from
  (old.property_id,old.status,old.start_date,old.end_date) then return new; end if;
 if new.status is null or lower(btrim(new.status)) not in ('active','draft','expired','terminated') then raise exception 'Contract status needs review before occupancy changes' using errcode='PT409'; end if;
 select unit_id into unit from portal_private.leasing_contract_units where contract_id=new.id;
 if unit is null then
  -- Legacy unmapped contracts remain visible as mapping-required. They cannot displace a hold/booking.
  if lower(btrim(new.status))='active' then
   perform id from portal_private.leasing_units where property_id=new.property_id order by id for update;
   if exists(select 1 from portal_private.leasing_holds h join portal_private.leasing_units u on u.id=h.unit_id
    join portal_private.leasing_cases c on c.id=h.case_id where u.property_id=new.property_id
    and h.expires_at>clock_timestamp() and c.booking_cancelled_at is null and c.stage not in ('CONFIRMED','CANCELLED','LOST')
    and (new.start_date is null or new.end_date is null or new.end_date<=new.start_date or (h.start_date<new.end_date and h.end_date>new.start_date)))
   or exists(select 1 from portal_private.leasing_cases c join portal_private.leasing_units u on u.id=c.unit_id
    where u.property_id=new.property_id and c.stage='CONFIRMED' and c.booking_cancelled_at is null and c.contract_id is distinct from new.id
    and (new.start_date is null or new.end_date is null or new.end_date<=new.start_date or (c.start_date<new.end_date and c.end_date>new.start_date))) then
    raise exception 'Map a draft contract before activating it on an occupied property' using errcode='PT409';
   end if;
  end if;
  return new;
 end if;
 perform 1 from portal_private.leasing_units where id=unit for update;
 if new.property_id is distinct from (select property_id from portal_private.leasing_units where id=unit) then
  raise exception 'Mapped contract property cannot change' using errcode='PT409';
 end if;
 if lower(btrim(new.status))<>'active' then return new; end if;
 if new.start_date is null or new.end_date is null or new.end_date<=new.start_date then raise invalid_parameter_value; end if;
 if exists(select 1 from portal_private.leasing_cases c where c.contract_id=new.id and c.stage='CONFIRMED' and c.booking_cancelled_at is null
  and (c.unit_id,c.start_date,c.end_date) is distinct from (unit,new.start_date,new.end_date))
 or exists(select 1 from portal_private.leasing_contract_units l join public.contracts c on c.id=l.contract_id
  where l.unit_id=unit and c.id<>new.id and lower(btrim(c.status))='active'
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<new.end_date and c.end_date>new.start_date)))
 or exists(select 1 from portal_private.leasing_cases c where c.unit_id=unit and c.contract_id is distinct from new.id
  and c.stage='CONFIRMED' and c.booking_cancelled_at is null and c.start_date<new.end_date and c.end_date>new.start_date)
 or exists(select 1 from portal_private.leasing_holds h join portal_private.leasing_cases c on c.id=h.case_id
  where h.unit_id=unit and h.expires_at>clock_timestamp() and c.booking_cancelled_at is null
  and c.stage not in ('CONFIRMED','CANCELLED','LOST') and h.start_date<new.end_date and h.end_date>new.start_date
  and not (c.contract_id is not distinct from new.id and h.start_date=new.start_date and h.end_date=new.end_date)) then
  raise exception 'Contract conflicts with an existing reservation or contract' using errcode='PT409';
 end if;
 return new;
end $$;
revoke all on function portal_private.guard_mapped_contract() from public,anon,authenticated,service_role;
create trigger leasing_contract_guard before insert or update on public.contracts
 for each row execute function portal_private.guard_mapped_contract();
-- Keep both legacy operations implementations consistent with explicit booking cancellation.
do $$
declare signature text; definition text; needle text := 'other.stage=''CONFIRMED'' and other.start_date';
begin
 foreach signature in array array['portal_private.operations_core_v1(text,jsonb)','portal_private.leasing_core_v1(text,jsonb)'] loop
  if to_regprocedure(signature) is null then
   if signature like '%operations_core_v1%' then raise exception 'Operations core missing'; end if;
   continue;
  end if;
  definition:=pg_get_functiondef(to_regprocedure(signature));
  if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then
   raise exception 'Unexpected legacy confirmation implementation';
  end if;
  execute replace(definition,needle,'other.stage=''CONFIRMED'' and other.booking_cancelled_at is null and other.start_date');
 end loop;
end $$;

-- Source: leasing-reservation-access.sql
grant execute on function public.leasing_unit_availability(date,date) to kohl_leasing;
grant execute on function public.reserve_leasing_unit(uuid,uuid,date,date) to kohl_leasing;
grant execute on function public.leasing_reservation_status() to kohl_leasing;
revoke all on portal_private.leasing_unit_specs,portal_private.leasing_holds,portal_private.leasing_contract_units from kohl_leasing;
revoke all on function public.extend_leasing_hold(uuid,text),public.cancel_leasing_booking(uuid),
 public.link_leasing_contract_unit(uuid,uuid),public.save_leasing_unit_specs(uuid,integer,integer) from kohl_leasing;

notify pgrst,'reload schema';
commit;
