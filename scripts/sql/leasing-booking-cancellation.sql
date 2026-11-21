-- Candidate for isolated testing only; not a production migration dispatcher.
begin;
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
commit;
