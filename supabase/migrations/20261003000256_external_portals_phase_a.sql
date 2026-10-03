-- Phase A only. Apply during a coordinated Auth cutover, never to a running
-- legacy anonymous client. See docs/phase-a-runbook.md. Tested on PG17.
begin;
create schema portal_private;
revoke all on schema portal_private from public, anon, authenticated;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='kohl_portal_reader') then
  create role kohl_portal_reader nologin bypassrls;
 end if;
end $$;
grant kohl_portal_reader to postgres;
grant create on schema public, portal_private to kohl_portal_reader;
grant usage on schema public, auth, portal_private to kohl_portal_reader;

create table portal_private.accounts (
 user_id uuid primary key references auth.users(id) on delete restrict,
 full_name text not null check(length(trim(full_name)) > 0),
 mobile text not null check(mobile ~ '^05[0-9]{8}$'),
 national_id_or_iqama text,
 role text not null check(role in ('ADMIN','CEO','HR','EMPLOYEE','BROKER','OWNER','TENANT')),
 is_active boolean not null default false,
 employee_id uuid unique references public.employees(id),
 lessor_id uuid references public.lessors(id), tenant_id uuid references public.tenants(id),
 invitation_status text not null default 'PENDING' check(invitation_status in ('PENDING','SENT','FAILED')),
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table portal_private.settings (
 singleton boolean primary key default true check(singleton),
 tenant_lease_end_action text not null default 'HISTORY' check(tenant_lease_end_action in ('HISTORY','DEACTIVATE'))
);
insert into portal_private.settings values(true,'HISTORY');
create table portal_private.access_audit (
 id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id),
 target_user_id uuid references auth.users(id), action text not null,
 changes jsonb not null default '{}'::jsonb, request_id uuid not null,
 created_at timestamptz not null default now()
);
create table portal_private.owner_property_links (
 id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references portal_private.accounts(user_id),
 property_id uuid not null references public.properties(id),
 ownership_share numeric(7,4) not null check(ownership_share > 0 and ownership_share <= 100),
 effective_from date not null, effective_to date,
 check(effective_to is null or effective_to >= effective_from), unique(owner_user_id,property_id,effective_from)
);
create index on portal_private.owner_property_links(property_id);
create table portal_private.tenant_lease_links (
 tenant_user_id uuid not null references portal_private.accounts(user_id),
 contract_id uuid not null references public.contracts(id), created_at timestamptz not null default now(),
 primary key(tenant_user_id,contract_id)
);
create index on portal_private.tenant_lease_links(contract_id);
create table portal_private.broker_office_agreements (
 id uuid primary key default gen_random_uuid(), broker_user_id uuid not null references portal_private.accounts(user_id),
 agreement_number text not null unique,
 commission_type text not null check(commission_type in ('PERCENTAGE','FIXED')),
 commission_value numeric(14,2) not null check(commission_value >= 0),
 percentage_basis text check(percentage_basis in ('DEAL_VALUE','OFFICE_COMMISSION')),
 effective_from date not null, effective_to date,
 check(effective_to is null or effective_to >= effective_from),
 check((commission_type='PERCENTAGE' and commission_value<=100 and percentage_basis is not null)
   or (commission_type='FIXED' and percentage_basis is null)), unique(id,broker_user_id)
);
create table portal_private.broker_contract_links (
 broker_user_id uuid not null references portal_private.accounts(user_id),
 contract_id uuid not null references public.contracts(id), agreement_id uuid not null,
 primary key(broker_user_id,contract_id),
 foreign key(agreement_id,broker_user_id) references portal_private.broker_office_agreements(id,broker_user_id)
);
create index on portal_private.broker_contract_links(contract_id);

-- The reader owns only narrow functions, has SELECT only and cannot log in.
-- Its bypass privilege avoids account-policy recursion. No broad API exposes it.
grant select on all tables in schema portal_private to kohl_portal_reader;
grant select on public.properties, public.contracts to kohl_portal_reader;
grant execute on function auth.uid() to kohl_portal_reader;
create function portal_private.has_role(expected text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from portal_private.accounts where user_id=auth.uid() and is_active and role=expected);
$$;
alter function portal_private.has_role(text) owner to kohl_portal_reader;
create function portal_private.is_executive() returns boolean
language sql stable security definer set search_path='' as $$
 select portal_private.has_role('ADMIN') or portal_private.has_role('CEO');
$$;
alter function portal_private.is_executive() owner to kohl_portal_reader;
create function portal_private.employee_id() returns uuid
language sql stable security definer set search_path='' as $$
 select employee_id from portal_private.accounts where user_id=auth.uid() and is_active and role='EMPLOYEE';
$$;
alter function portal_private.employee_id() owner to kohl_portal_reader;
grant usage on schema portal_private to authenticated;
revoke all on function portal_private.has_role(text),portal_private.is_executive(),portal_private.employee_id() from public,anon;
grant execute on function portal_private.has_role(text),portal_private.is_executive(),portal_private.employee_id() to authenticated;

create function portal_private.check_link() returns trigger language plpgsql set search_path='' as $$
declare actual_role text; total numeric; edge date;
begin
 if tg_table_name='owner_property_links' then
   select role into actual_role from portal_private.accounts where user_id=new.owner_user_id;
   if actual_role is distinct from 'OWNER' then raise exception 'Owner role required'; end if;
   -- Serialize allocation changes; calculate total at every interval boundary.
   perform 1 from public.properties where id=new.property_id for update;
   for edge in select new.effective_from union select effective_from from portal_private.owner_property_links
     where property_id=new.property_id and id<>new.id and (new.effective_to is null or effective_from<=new.effective_to)
       and (effective_to is null or effective_to>=new.effective_from) loop
     select coalesce(sum(ownership_share),0) into total from portal_private.owner_property_links
       where property_id=new.property_id and id<>new.id and effective_from<=greatest(edge,new.effective_from)
         and (effective_to is null or effective_to>=greatest(edge,new.effective_from));
     if total+new.ownership_share>100 then raise exception 'Ownership exceeds 100 percent'; end if;
   end loop;
 elsif tg_table_name='tenant_lease_links' then
   select role into actual_role from portal_private.accounts where user_id=new.tenant_user_id;
   if actual_role is distinct from 'TENANT' then raise exception 'Tenant role required'; end if;
 else
   select role into actual_role from portal_private.accounts where user_id=new.broker_user_id;
   if actual_role is distinct from 'BROKER' then raise exception 'Broker role required'; end if;
 end if;
 return new;
end $$;
create trigger check_owner before insert or update on portal_private.owner_property_links for each row execute function portal_private.check_link();
create trigger check_tenant before insert or update on portal_private.tenant_lease_links for each row execute function portal_private.check_link();
create trigger check_broker before insert or update on portal_private.broker_office_agreements for each row execute function portal_private.check_link();
create trigger check_broker_contract before insert or update on portal_private.broker_contract_links for each row execute function portal_private.check_link();

create function public.portal_me() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare account portal_private.accounts; result jsonb; has_lease boolean;
begin
 select * into account from portal_private.accounts where user_id=auth.uid() and is_active;
 if account.user_id is null then raise insufficient_privilege using message='Inactive or unassigned account'; end if;
 select exists(select 1 from portal_private.tenant_lease_links l join public.contracts c on c.id=l.contract_id
   where l.tenant_user_id=account.user_id and lower(c.status) in ('active','ساري')
     and c.start_date<=(now() at time zone 'Asia/Riyadh')::date and c.end_date>=(now() at time zone 'Asia/Riyadh')::date) into has_lease;
 if account.role='TENANT' and not has_lease and exists(select 1 from portal_private.settings where tenant_lease_end_action='DEACTIVATE')
   then raise insufficient_privilege using message='Lease access has ended'; end if;
 result:=jsonb_build_object('id',account.user_id,'name',account.full_name,'phone',account.mobile,'role',account.role,
  'employee_id',account.employee_id,'history_only',account.role='TENANT' and not has_lease);
 return jsonb_build_object('account',result,
  'owners',coalesce((select jsonb_agg(jsonb_build_object('property_id',l.property_id,'ownership_share',l.ownership_share,
    'effective_from',l.effective_from,'effective_to',l.effective_to)) from portal_private.owner_property_links l
    where l.owner_user_id=account.user_id and account.role='OWNER' and l.effective_from<=(now() at time zone 'Asia/Riyadh')::date
      and (l.effective_to is null or l.effective_to>=(now() at time zone 'Asia/Riyadh')::date)),'[]'::jsonb),
  'leases',coalesce((select jsonb_agg(jsonb_build_object('contract_id',contract_id)) from portal_private.tenant_lease_links
    where tenant_user_id=account.user_id and account.role='TENANT'),'[]'::jsonb),
  'broker_contracts',coalesce((select jsonb_agg(jsonb_build_object('contract_id',contract_id,'agreement_id',agreement_id))
    from portal_private.broker_contract_links where broker_user_id=account.user_id and account.role='BROKER'),'[]'::jsonb));
end $$;
alter function public.portal_me() owner to kohl_portal_reader;
revoke all on function public.portal_me() from public,anon;
grant execute on function public.portal_me() to authenticated;
revoke create on schema public, portal_private from kohl_portal_reader;

-- Administrative RPC is callable only with the server secret. The API validates
-- the bearer through Auth.getUser; the DB rechecks the actor under row lock.
create function public.portal_admin(actor uuid, operation text, payload jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; account portal_private.accounts; item jsonb; agreement uuid;
  existing_role text; result jsonb; property uuid; starts date;
begin
 perform 1 from portal_private.accounts where user_id=actor and is_active and role in ('ADMIN','CEO') for update;
 if not found then raise insufficient_privilege using message='Active executive required'; end if;
 if operation='LIST' then
   return jsonb_build_object('users',coalesce((select jsonb_agg(jsonb_build_object(
     'id',a.user_id,'full_name',a.full_name,'mobile',a.mobile,'national_id_or_iqama',a.national_id_or_iqama,
     'role',a.role,'is_active',a.is_active,'invitation_status',a.invitation_status,'email',u.email,
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
    'settings',(select to_jsonb(s) from portal_private.settings s),
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from portal_private.access_audit order by created_at desc limit 100) a),'[]'));
 end if;
 target:=nullif(payload->>'user_id','')::uuid;
 if operation='SAVE' then
   if payload->>'role' not in ('OWNER','TENANT','BROKER') then raise exception 'External role required'; end if;
   select role into existing_role from portal_private.accounts where user_id=target for update;
   if existing_role is not null and existing_role<>payload->>'role' then raise exception 'Role changes require a new verified account'; end if;
   insert into portal_private.accounts(user_id,full_name,mobile,national_id_or_iqama,role,is_active,created_by)
     values(target,payload->>'full_name',payload->>'mobile',nullif(payload->>'national_id_or_iqama',''),payload->>'role',false,actor)
     on conflict(user_id) do update set full_name=excluded.full_name,mobile=excluded.mobile,
       national_id_or_iqama=excluded.national_id_or_iqama,updated_at=now();
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
   else
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
    'event',payload->>'event','owners',payload->'owners','leases',payload->'leases',
    'broker_contracts',payload->'broker_contracts','agreement_id',agreement),request_id);
 return jsonb_build_object('user_id',target,'ok',true);
end $$;
revoke all on function public.portal_admin(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.portal_admin(uuid,text,jsonb,uuid) to service_role;

-- Private tables remain unexposed and deny all direct client access.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='portal_private' loop
   execute format('alter table portal_private.%I enable row level security',t.tablename);
   execute format('revoke all on portal_private.%I from public,anon,authenticated',t.tablename);
 end loop;
end $$;
revoke all on all functions in schema portal_private from public,anon;
-- Trigger functions need no direct EXECUTE grants.

-- Remove permissive policies/grants on every exposed existing relation; unknown
-- tables remain denied. No destructive data/schema operations are performed.
do $$ declare t record; p record; business_tables text[]:=array[
 'lessors','tenants','representatives','ownership_documents','properties','e_poas','contracts','brokerage_agreements',
 'managed_properties','managed_property_contracts','property_maintenance_tasks','financial_transactions','general_services',
 'customer_orders','ownership_audit_logs','daily_financial_summaries','ai_daily_reports','employees','timesheet_entries',
 'payroll_payments','leave_requests','task_delegations','crm_leads','crm_deals','crm_activities','archived_documents'];
begin
 for t in select c.relname,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p','v','m') loop
   execute format('revoke all on public.%I from public,anon,authenticated',t.relname);
   if exists(select 1 from pg_roles where rolname='web_anon') then execute format('revoke all on public.%I from web_anon',t.relname); end if;
   if t.relkind in ('r','p') then
     execute format('alter table public.%I enable row level security',t.relname);
     for p in select policyname from pg_policies where schemaname='public' and tablename=t.relname loop
       execute format('drop policy %I on public.%I',p.policyname,t.relname);
     end loop;
     if t.relname=any(business_tables) then
       execute format('grant select,insert,update,delete on public.%I to authenticated',t.relname);
       execute format('create policy executive_all on public.%I for all to authenticated using (portal_private.is_executive()) with check (portal_private.is_executive())',t.relname);
     end if;
   end if;
 end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon,authenticated;
alter default privileges in schema public revoke execute on functions from public;

-- Preserve internal scopes explicitly. These predicates apply to every query,
-- including direct REST calls; legacy staff role text cannot grant Auth rights.
create policy hr_employees on public.employees for all to authenticated using(portal_private.has_role('HR')) with check(portal_private.has_role('HR'));
create policy employee_self on public.employees for select to authenticated using(id=portal_private.employee_id());
do $$ declare t text; begin
 foreach t in array array['timesheet_entries','payroll_payments','leave_requests'] loop
   execute format('create policy hr_all on public.%I for all to authenticated using(portal_private.has_role(''HR'')) with check(portal_private.has_role(''HR''))',t);
   execute format('create policy employee_read on public.%I for select to authenticated using(employee_id=portal_private.employee_id())',t);
 end loop;
 foreach t in array array['crm_leads','crm_deals','contracts','brokerage_agreements'] loop
   execute format('create policy agent_all on public.%I for all to authenticated using(assigned_agent_id=portal_private.employee_id()) with check(assigned_agent_id=portal_private.employee_id())',t);
 end loop;
end $$;
create policy employee_timesheet_insert on public.timesheet_entries for insert to authenticated with check(employee_id=portal_private.employee_id());
create policy employee_timesheet_update on public.timesheet_entries for update to authenticated using(employee_id=portal_private.employee_id()) with check(employee_id=portal_private.employee_id());
create policy employee_leave_insert on public.leave_requests for insert to authenticated with check(employee_id=portal_private.employee_id() and status='PENDING' and approved_at is null and approved_by is null);
create policy employee_tasks_read on public.task_delegations for select to authenticated using(assigned_to_employee_id=portal_private.employee_id());
create policy employee_tasks_update on public.task_delegations for update to authenticated using(assigned_to_employee_id=portal_private.employee_id()) with check(assigned_to_employee_id=portal_private.employee_id());
create function portal_private.task_update_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if portal_private.has_role('EMPLOYEE') and (to_jsonb(new)-array['status','completed_at']) is distinct from (to_jsonb(old)-array['status','completed_at'])
 then raise insufficient_privilege using message='Only task status may be changed'; end if;
 return new;
end $$;
create trigger portal_task_update before update on public.task_delegations for each row execute function portal_private.task_update_guard();
do $$ declare t text; begin
 foreach t in array array['properties','lessors','tenants','representatives','ownership_documents','e_poas',
 'managed_properties','managed_property_contracts','property_maintenance_tasks','customer_orders','general_services','archived_documents'] loop
  if to_regclass('public.'||t) is not null then
   execute format('create policy employee_operations on public.%I for all to authenticated using(portal_private.has_role(''EMPLOYEE'')) with check(portal_private.has_role(''EMPLOYEE''))',t);
  end if;
 end loop;
 if to_regclass('public.archived_documents') is not null then
  execute 'create policy hr_archive on public.archived_documents for all to authenticated using(portal_private.has_role(''HR'')) with check(portal_private.has_role(''HR''))';
 end if;
end $$;
create policy agent_activity on public.crm_activities for all to authenticated
 using(exists(select 1 from public.crm_leads l where l.id=lead_id and l.assigned_agent_id=portal_private.employee_id())
 or exists(select 1 from public.crm_deals d where d.id=deal_id and d.assigned_agent_id=portal_private.employee_id()))
 with check(exists(select 1 from public.crm_leads l where l.id=lead_id and l.assigned_agent_id=portal_private.employee_id())
 or exists(select 1 from public.crm_deals d where d.id=deal_id and d.assigned_agent_id=portal_private.employee_id()));
-- No external Storage access in Phase A. Later phases add private resource policies.
-- Existing storage policy/catalog review is required before enabling upload screens.
notify pgrst,'reload schema';
commit;
