-- Isolated candidate: apply after leasing-unit-availability.sql. Not a release.
begin;
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
  and ct.status='Active' and (ct.start_date is null or ct.end_date is null or ct.end_date<=ct.start_date or (ct.start_date<h.end_date and ct.end_date>h.start_date))
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
commit;
