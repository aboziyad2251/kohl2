-- Candidate applied after specialist account and all availability candidates.
begin;
grant execute on function public.leasing_unit_availability(date,date) to kohl_leasing;
grant execute on function public.reserve_leasing_unit(uuid,uuid,date,date) to kohl_leasing;
grant execute on function public.leasing_reservation_status() to kohl_leasing;
revoke all on portal_private.leasing_unit_specs,portal_private.leasing_holds,portal_private.leasing_contract_units from kohl_leasing;
revoke all on function public.extend_leasing_hold(uuid,text),public.cancel_leasing_booking(uuid),
 public.link_leasing_contract_unit(uuid,uuid),public.save_leasing_unit_specs(uuid,integer,integer) from kohl_leasing;
commit;
