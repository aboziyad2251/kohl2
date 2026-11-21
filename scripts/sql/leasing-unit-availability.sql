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
 select u.id,u.property_id,u.code,u.readiness,
 exists(select 1 from public.contracts c where c.property_id=u.property_id and c.status='Active'
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<to_date and c.end_date>from_date))
  and not exists(select 1 from portal_private.leasing_contract_units l join portal_private.leasing_units target on target.id=l.unit_id
   where l.contract_id=c.id and target.property_id=c.property_id)) as needs_mapping,
 exists(select 1 from portal_private.leasing_contract_units l join public.contracts c on c.id=l.contract_id
  where l.unit_id=u.id and c.status='Active'
  and (c.start_date is null or c.end_date is null or c.end_date<=c.start_date or (c.start_date<to_date and c.end_date>from_date))) as contracted,
 exists(select 1 from portal_private.leasing_cases c where c.unit_id=u.id and c.stage='CONFIRMED'
  and c.booking_cancelled_at is null and c.start_date<to_date and c.end_date>from_date) as booked
 from portal_private.leasing_units u)
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'property_id',property_id,'code',code,'readiness',readiness,
  'available',readiness='READY' and not needs_mapping and not contracted and not booked,
  'reason',case when needs_mapping then 'CONTRACT_MAPPING_REQUIRED' when contracted then 'CONTRACTED'
   when booked then 'BOOKED' when readiness<>'READY' then 'NOT_READY' else 'AVAILABLE' end) order by code,id),'[]'::jsonb)
 into result from state;
 return jsonb_build_object('from',from_date,'to',to_date,'units',result);
end $$;
revoke all on function public.leasing_unit_availability(date,date) from public,anon,service_role;
grant execute on function public.leasing_unit_availability(date,date) to authenticated;
notify pgrst,'reload schema';
commit;
