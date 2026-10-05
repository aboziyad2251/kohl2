-- Employee login creation: retain private executive authorization and Auth-only passwords.
create or replace function public.portal_admin(actor uuid, operation text, payload jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; account portal_private.accounts; item jsonb; agreement uuid;
  existing_role text; result jsonb; property uuid; starts date;
begin
 perform 1 from portal_private.accounts where user_id=actor and is_active and role in ('ADMIN','CEO') for update;
 if not found then raise insufficient_privilege using message='Active executive required'; end if;
 if operation='LIST' then
   return jsonb_build_object('users',coalesce((select jsonb_agg(jsonb_build_object(
     'id',a.user_id,'full_name',a.full_name,'mobile',a.mobile,'national_id_or_iqama',a.national_id_or_iqama,
     'employee_id',a.employee_id,'role',a.role,'is_active',a.is_active,'invitation_status',a.invitation_status,'email',u.email,
     'last_login',u.last_sign_in_at,'created_at',a.created_at,
     'owners',coalesce((select jsonb_agg(to_jsonb(l)) from portal_private.owner_property_links l where l.owner_user_id=a.user_id),'[]'),
     'leases',coalesce((select jsonb_agg(to_jsonb(l)) from portal_private.tenant_lease_links l where l.tenant_user_id=a.user_id),'[]'),
     'agreements',coalesce((select jsonb_agg(to_jsonb(l)) from portal_private.broker_office_agreements l where l.broker_user_id=a.user_id),'[]'),
     'broker_contracts',coalesce((select jsonb_agg(to_jsonb(l)) from portal_private.broker_contract_links l where l.broker_user_id=a.user_id),'[]')
     ) order by a.created_at desc) from portal_private.accounts a join auth.users u on u.id=a.user_id),'[]'),
    'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(to_jsonb(p)->>'property_name',to_jsonb(p)->>'title')))
      from public.properties p),'[]'),
    'contracts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'number',contract_number,'property_id',property_id,
      'tenant_name',tenant_name,'status',status,'start_date',start_date,'end_date',end_date)) from public.contracts),'[]'),
    'employees',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'employee_number',e.employee_number,'email',e.email,'phone',e.phone,'status',e.status) order by e.name) from public.employees e),'[]'),
    'settings',(select to_jsonb(s) from portal_private.settings s),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from portal_private.access_audit order by created_at desc limit 100) a),'[]'));
 end if;
 target:=nullif(payload->>'user_id','')::uuid;
 if operation='SAVE' then
   if coalesce(payload->>'role','') not in ('OWNER','TENANT','BROKER','EMPLOYEE') then raise exception 'Managed role required'; end if;
   if payload->>'role'='EMPLOYEE' then
     if nullif(payload->>'employee_id','') is null then raise exception 'Employee record required'; end if;
     perform 1 from public.employees where id=(payload->>'employee_id')::uuid and status='ACTIVE' for update;
     if not found then raise exception 'Active employee record required'; end if;
     if coalesce(jsonb_array_length(payload->'owners'),0)>0 or coalesce(jsonb_array_length(payload->'leases'),0)>0
        or coalesce(jsonb_array_length(payload->'broker_contracts'),0)>0 or nullif(payload->>'agreement_id','') is not null
        or (payload->'agreement' is not null and payload->'agreement'<>'null'::jsonb) then raise exception 'Employee cannot have external links'; end if;
     if exists(select 1 from portal_private.accounts where user_id=target and employee_id is distinct from (payload->>'employee_id')::uuid) then
       raise exception 'Employee link cannot be reassigned'; end if;
   elsif nullif(payload->>'employee_id','') is not null then raise exception 'External account cannot have employee link'; end if;
   select role into existing_role from portal_private.accounts where user_id=target for update;
   if existing_role is not null and existing_role<>payload->>'role' then raise exception 'Role changes require a new verified account'; end if;
   insert into portal_private.accounts(user_id,full_name,mobile,national_id_or_iqama,role,employee_id,is_active,created_by)
     values(target,payload->>'full_name',payload->>'mobile',nullif(payload->>'national_id_or_iqama',''),payload->>'role',nullif(payload->>'employee_id','')::uuid,false,actor)
     on conflict(user_id) do update set full_name=excluded.full_name,mobile=excluded.mobile,
       national_id_or_iqama=excluded.national_id_or_iqama,employee_id=excluded.employee_id,updated_at=now();
   if payload->>'role'='OWNER' then
     if jsonb_array_length(payload->'owners')<1 then raise exception 'At least one property required'; end if;
     -- End old assignments, preserve earlier history. Delete only same-day/future
     -- assignments not yet used by later-phase accounting tables.
     starts:=(now() at time zone 'Asia/Riyadh')::date;
     perform 1 from public.properties where id in (select property_id from portal_private.owner_property_links where owner_user_id=target
       union select (value->>'property_id')::uuid from jsonb_array_elements(payload->'owners')) order by id for update;
     delete from portal_private.owner_property_links where owner_user_id=target and effective_from>=starts;
     update portal_private.owner_property_links set effective_to=starts-1 where owner_user_id=target and effective_from<starts and (effective_to is null or effective_to>=starts);
     for item in select value from jsonb_array_elements(payload->'owners') loop
       insert into portal_private.owner_property_links(owner_user_id,property_id,ownership_share,effective_from)
         values(target,(item->>'property_id')::uuid,(item->>'ownership_share')::numeric,starts);
     end loop;
   elsif payload->>'role'='TENANT' then
     if jsonb_array_length(payload->'leases')<1 then raise exception 'Lease required'; end if;
     -- Explicit replacement revokes removed links immediately, per approved policy.
     delete from portal_private.tenant_lease_links where tenant_user_id=target;
     for item in select value from jsonb_array_elements(payload->'leases') loop
       perform 1 from public.contracts where id=(item#>>'{}')::uuid and lower(status) in ('active','ساري')
         and start_date<=(now() at time zone 'Asia/Riyadh')::date and end_date>=(now() at time zone 'Asia/Riyadh')::date;
       if not found then raise exception 'Current active lease required'; end if;
       insert into portal_private.tenant_lease_links values(target,(item#>>'{}')::uuid,now());
     end loop;
   elsif payload->>'role'='BROKER' then
     agreement:=nullif(payload->>'agreement_id','')::uuid;
     if agreement is null then
       insert into portal_private.broker_office_agreements(broker_user_id,agreement_number,commission_type,commission_value,percentage_basis,effective_from)
         values(target,payload->'agreement'->>'agreement_number',payload->'agreement'->>'commission_type',
          (payload->'agreement'->>'commission_value')::numeric,payload->'agreement'->>'percentage_basis',(now() at time zone 'Asia/Riyadh')::date)
         returning id into agreement;
     end if;
     perform 1 from portal_private.broker_office_agreements where id=agreement and broker_user_id=target;
     if not found then raise exception 'Agreement belongs to another broker'; end if;
     delete from portal_private.broker_contract_links where broker_user_id=target;
     for item in select value from jsonb_array_elements(payload->'broker_contracts') loop
       insert into portal_private.broker_contract_links values(target,(item#>>'{}')::uuid,agreement);
     end loop;
   end if;
 elsif operation='STATUS' then
   if target=actor then raise exception 'Cannot deactivate your own account'; end if;
   update portal_private.accounts set is_active=(payload->>'is_active')::boolean,updated_at=now() where user_id=target;
   if not found then raise exception 'Account not found'; end if;
 elsif operation='INVITATION' then
   update portal_private.accounts set invitation_status=payload->>'status',updated_at=now() where user_id=target;
   if not found then raise exception 'Account not found'; end if;
 elsif operation='SETTINGS' then
   update portal_private.settings set tenant_lease_end_action=payload->>'tenant_lease_end_action' where singleton;
 elsif operation='AUTH_EVENT' then
   if not exists(select 1 from portal_private.accounts where user_id=target) then raise exception 'Account not found'; end if;
 else raise exception 'Unknown operation'; end if;
 -- Only an allowlisted, non-secret summary is persisted; never whole payloads.
 insert into portal_private.access_audit(actor_user_id,target_user_id,action,changes,request_id)
   values(actor,target,operation,jsonb_build_object('role',payload->>'role','is_active',payload->'is_active',
    'tenant_lease_end_action',payload->>'tenant_lease_end_action','status',payload->>'status',
    'event',payload->>'event','employee_id',payload->>'employee_id','owners',payload->'owners','leases',payload->'leases',
    'broker_contracts',payload->'broker_contracts','agreement_id',agreement),request_id);
 return jsonb_build_object('user_id',target,'ok',true);
end $$;
revoke all on function public.portal_admin(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.portal_admin(uuid,text,jsonb,uuid) to service_role;

