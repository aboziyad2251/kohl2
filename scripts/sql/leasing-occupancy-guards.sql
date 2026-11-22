-- Isolated candidate: guards legacy writers as well as the new reservation RPCs.
begin;
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
commit;
