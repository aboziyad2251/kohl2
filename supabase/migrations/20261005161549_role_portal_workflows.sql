-- Extend the ERP sources; keep legacy columns and workflows intact.
begin;
alter table public.contracts add column if not exists unit_label text,
 add column if not exists unit_details text,
 add column if not exists owner_contact_visible boolean not null default false;
alter table public.financial_transactions add column if not exists period_start date,
 add column if not exists period_end date,
 add column if not exists owner_charge boolean not null default false,
 add column if not exists maintenance_task_id uuid references public.property_maintenance_tasks(id);
alter table public.property_maintenance_tasks add column if not exists contract_id uuid references public.contracts(id),
 add column if not exists requested_by uuid references portal_private.accounts(user_id),
 add column if not exists workflow_status text check(workflow_status in ('pending','under_review','awaiting_customer_approval','awaiting_manager_approval','scheduled','in_progress','completed','closed','rejected','cancelled')),
 add column if not exists cost_bearer text check(cost_bearer in ('tenant','owner','company')),
 add column if not exists cost_customer_id uuid references portal_private.accounts(user_id),
 add column if not exists preferred_visit_at timestamptz,
 add column if not exists scheduled_at timestamptz,
 add column if not exists completed_at timestamptz;
alter table portal_private.broker_contract_links
 add column if not exists commission_type text check(commission_type in ('PERCENTAGE','FIXED')),
 add column if not exists commission_value numeric(14,4) check(commission_value>=0),
 add column if not exists percentage_basis text check(percentage_basis in ('DEAL_VALUE','OFFICE_COMMISSION')),
 add column if not exists payout_status text not null default 'pending' check(payout_status in ('pending','approved','paid')),
 add column if not exists paid_at timestamptz,
 add column if not exists closed_at timestamptz,
 add constraint portal_commission_override_valid check(
  (commission_type is null and commission_value is null and percentage_basis is null) or
  (commission_type='FIXED' and commission_value is not null and percentage_basis is null) or
  (commission_type='PERCENTAGE' and commission_value between 0 and 100 and percentage_basis is not null));

-- Obligations are not receipts: actual payments remain in financial_transactions.
create table portal_private.payment_dues (
 id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.contracts(id),
 kind text not null check(kind in ('rent','utility','service')), description text not null,
 due_date date not null, period_start date not null, period_end date not null,
 amount numeric(14,2) not null check(amount>0), check(period_end>=period_start)
);
alter table public.financial_transactions add column if not exists payment_due_id uuid references portal_private.payment_dues(id);
create index on portal_private.payment_dues(contract_id,due_date);
create index on public.financial_transactions(payment_due_id);
create table portal_private.maintenance_history (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.property_maintenance_tasks(id),
 actor_user_id uuid references auth.users(id), from_status text, to_status text not null,
 note text not null default '', created_at timestamptz not null default now()
);
create index on portal_private.maintenance_history(task_id,created_at);
create table portal_private.maintenance_attachments (
 id uuid primary key default gen_random_uuid(), task_id uuid not null references public.property_maintenance_tasks(id),
 uploaded_by uuid not null references auth.users(id), object_path text not null unique,
 filename text not null, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 created_at timestamptz not null default now()
);
create table portal_private.broker_kpis (
 id uuid primary key default gen_random_uuid(), broker_user_id uuid not null references portal_private.accounts(user_id),
 name text not null, metric text not null check(metric in ('contract_count','contract_value','commission','custom')),
 target numeric(14,2) not null check(target>0), period text not null check(period in ('monthly','quarterly')),
 period_start date not null, period_end date not null, weight numeric(8,2) check(weight>=0),
 check(period_end>=period_start)
);
create table portal_private.kpi_events (
 id uuid primary key default gen_random_uuid(), kpi_id uuid not null references portal_private.broker_kpis(id),
 value numeric(14,2) not null, event_date date not null, note text not null
);
create table portal_private.portal_audit (
 id uuid primary key default gen_random_uuid(), actor_user_id uuid references auth.users(id),
 resource text not null, resource_id text not null, action text not null,
 before_value jsonb, after_value jsonb, created_at timestamptz not null default now()
);
create table portal_private.documents (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references portal_private.accounts(user_id),
 kind text not null check(kind in ('payment','statement')), payment_id uuid references public.financial_transactions(id),
 verification_code uuid not null default gen_random_uuid() unique,
 snapshot jsonb not null, created_at timestamptz not null default now()
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('portal-maintenance','portal-maintenance',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do nothing;

-- Private tables use RLS and have no client grants. Verified server endpoints call
-- the single scoped RPC, which rechecks the active private profile under row lock.
do $$ declare t text; begin
 foreach t in array array['payment_dues','maintenance_history','maintenance_attachments','broker_kpis','kpi_events','portal_audit','documents'] loop
  execute format('alter table portal_private.%I enable row level security',t);
  execute format('revoke all on portal_private.%I from public,anon,authenticated',t);
 end loop;
end $$;

create function portal_private.resource_scope(actor uuid, property uuid, contract uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from portal_private.accounts a where a.user_id=actor and a.is_active and
  (a.role in ('ADMIN','CEO') or
   (a.role='OWNER' and exists(select 1 from portal_private.owner_property_links l where l.owner_user_id=actor and l.property_id=property
    and l.effective_from<=(now() at time zone 'Asia/Riyadh')::date and (l.effective_to is null or l.effective_to>=(now() at time zone 'Asia/Riyadh')::date))) or
   (a.role='TENANT' and contract is not null and exists(select 1 from portal_private.tenant_lease_links l where l.tenant_user_id=actor and l.contract_id=contract)) or
   (a.role='BROKER' and contract is not null and exists(select 1 from portal_private.broker_contract_links l where l.broker_user_id=actor and l.contract_id=contract))))
$$;
alter function portal_private.resource_scope(uuid,uuid,uuid) owner to kohl_portal_reader;
revoke all on function portal_private.resource_scope(uuid,uuid,uuid) from public,anon,authenticated;
create function portal_private.contract_value(annual_rent numeric, starts date, ends date) returns numeric
language sql immutable set search_path='' as $$
 select round(coalesce(sum(annual_rent * (least(ends+1,(s+interval '1 year')::date)-s::date)::numeric / ((s+interval '1 year')::date-s::date)),0),2)
 from generate_series(starts::timestamp,ends::timestamp,interval '1 year') s
$$;
revoke all on function portal_private.contract_value(numeric,date,date) from public,anon,authenticated;
-- RLS defence: customers cannot directly query sensitive raw ERP rows.
-- The existing policies grant only executives and scoped internal employees.

create function portal_private.portal_audit_trigger() returns trigger language plpgsql security definer set search_path='' as $$
declare who uuid; before_row jsonb; after_row jsonb; identifier text;
begin
 who:=auth.uid();
 if current_user in ('postgres','supabase_admin') and who is null then
  who:=nullif(current_setting('portal.actor',true),'')::uuid;
 end if;
 if TG_OP<>'INSERT' then before_row:=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then after_row:=to_jsonb(new); end if;
 identifier:=coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id',(after_row->>'broker_user_id')||':'||(after_row->>'contract_id'),(before_row->>'broker_user_id')||':'||(before_row->>'contract_id'),(after_row->>'tenant_user_id')||':'||(after_row->>'contract_id'),(before_row->>'tenant_user_id')||':'||(before_row->>'contract_id'));
 insert into portal_private.portal_audit(actor_user_id,resource,resource_id,action,before_value,after_value)
 values(who,TG_TABLE_NAME,identifier,TG_OP,before_row,after_row);
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
revoke all on function portal_private.portal_audit_trigger() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['accounts','owner_property_links','tenant_lease_links','broker_office_agreements','broker_contract_links','payment_dues','broker_kpis','kpi_events','documents','maintenance_attachments'] loop
  execute format('create trigger portal_change_audit after insert or update or delete on portal_private.%I for each row execute function portal_private.portal_audit_trigger()',t);
 end loop;
 foreach t in array array['properties','contracts','financial_transactions','property_maintenance_tasks'] loop
  execute format('create trigger portal_change_audit after insert or update or delete on public.%I for each row execute function portal_private.portal_audit_trigger()',t);
 end loop;
end $$;

create function portal_private.maintenance_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare who uuid; role_name text; previous text; next_status text; customer boolean;
begin
 if new.workflow_status is null and (TG_OP='INSERT' or old.workflow_status is null) then return new; end if;
 who:=auth.uid();
 if who is null and auth.role()='service_role' then who:=nullif(current_setting('portal.actor',true),'')::uuid; end if;
 -- Trusted operators use the same role mapping; a browser cannot set the actor.
 if who is null and session_user='supabase_admin' then who:=nullif(current_setting('portal.actor',true),'')::uuid; end if;
 select role into role_name from portal_private.accounts where user_id=who and is_active;
 if role_name is null then raise insufficient_privilege using message='Active actor required'; end if;
 if TG_OP='INSERT' then
  if new.workflow_status<>'pending' then raise exception 'New requests must be pending'; end if;
  insert into portal_private.maintenance_history(task_id,actor_user_id,to_status,note) values(new.id,who,'pending','Request created');
 else
  previous:=coalesce(old.workflow_status,case lower(old.status) when 'completed' then 'completed' when 'cancelled' then 'cancelled' when 'in_progress' then 'in_progress' else 'pending' end);
  next_status:=new.workflow_status;
  if role_name not in ('ADMIN','CEO') then
   if to_jsonb(new)-array['workflow_status','status','updated_at'] is distinct from to_jsonb(old)-array['workflow_status','status','updated_at'] then
    raise insufficient_privilege using message='Customers can change only workflow decisions'; end if;
  end if;
  if previous is distinct from next_status then
   customer:=who=old.cost_customer_id and ((old.cost_bearer='tenant' and role_name='TENANT') or (old.cost_bearer='owner' and role_name='OWNER'));
   if not ((previous='pending' and next_status in ('under_review','cancelled')) or
    (previous='under_review' and next_status in ('awaiting_customer_approval','awaiting_manager_approval','rejected')) or
    (previous='awaiting_customer_approval' and next_status in ('awaiting_manager_approval','rejected')) or
    (previous='awaiting_manager_approval' and next_status in ('scheduled','rejected')) or
    (previous='scheduled' and next_status='in_progress') or (previous='in_progress' and next_status='completed') or
    (previous='completed' and next_status='closed')) then raise exception 'Invalid maintenance transition'; end if;
   if previous='awaiting_customer_approval' and not customer then raise insufficient_privilege using message='Cost-bearing customer must decide'; end if;
   if previous='under_review' and next_status='awaiting_manager_approval' and old.cost_bearer is distinct from 'company' then raise exception 'Customer approval required'; end if;
   if not customer and role_name not in ('ADMIN','CEO') and not (previous='pending' and next_status='cancelled' and who=old.requested_by) then
    raise insufficient_privilege using message='Executive approval required'; end if;
   if next_status='awaiting_customer_approval' and (new.cost_customer_id is null or new.cost_bearer='company') then raise exception 'Select the cost-bearing customer'; end if;
   if next_status='scheduled' and new.scheduled_at is null then raise exception 'Visit schedule required'; end if;
   if next_status='completed' then new.completed_at:=now(); end if;
   insert into portal_private.maintenance_history(task_id,actor_user_id,from_status,to_status,note)
    values(new.id,who,previous,next_status,coalesce(current_setting('portal.note',true),''));
  end if;
 end if;
 new.status:=case new.workflow_status when 'in_progress' then 'In_Progress' when 'completed' then 'Completed' when 'closed' then 'Completed' when 'rejected' then 'Cancelled' when 'cancelled' then 'Cancelled' else 'Pending' end;
 return new;
end $$;
revoke all on function portal_private.maintenance_guard() from public,anon,authenticated;
-- History is inserted AFTER the parent to satisfy its FK; use a deferred FK.
alter table portal_private.maintenance_history drop constraint maintenance_history_task_id_fkey;
alter table portal_private.maintenance_history add constraint maintenance_history_task_id_fkey foreign key(task_id) references public.property_maintenance_tasks(id) deferrable initially deferred;
create trigger portal_maintenance_guard before insert or update on public.property_maintenance_tasks for each row execute function portal_private.maintenance_guard();

create function public.portal_workflow(actor uuid, operation text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare account portal_private.accounts; task public.property_maintenance_tasks; contract public.contracts;
 target uuid; result jsonb; property uuid; customer uuid; due portal_private.payment_dues; document portal_private.documents;
begin
 select * into account from portal_private.accounts where user_id=actor and is_active for update;
 if not found then raise insufficient_privilege using message='Active account required'; end if;
 perform set_config('portal.actor',actor::text,true);
 if operation='DASHBOARD' then
  if account.role not in ('TENANT','OWNER','BROKER','ADMIN','CEO') then raise insufficient_privilege; end if;
  return jsonb_build_object('role',account.role,'today',(now() at time zone 'Asia/Riyadh')::date,
   'properties',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(to_jsonb(p)->>'property_name',to_jsonb(p)->>'title'),'address',p.address,'city',p.city,'units_count',p.units_count))
    from public.properties p where account.role<>'BROKER' and (portal_private.resource_scope(actor,p.id) or exists(select 1 from public.contracts c where c.property_id=p.id and portal_private.resource_scope(actor,p.id,c.id)))),'[]'),
   'contracts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'number',c.contract_number,'property_id',c.property_id,'unit_label',c.unit_label,'unit_details',c.unit_details,'annual_rent',c.rent_amount,'start_date',c.start_date,'end_date',c.end_date,'status',c.status,'payment_schedule',c.payment_schedule,
    'tenant_name',case when account.role in ('TENANT','ADMIN','CEO') or (account.role='OWNER' and c.owner_contact_visible) then c.tenant_name else null end,
    'tenant_phone',case when account.role in ('ADMIN','CEO') or (account.role='OWNER' and c.owner_contact_visible) then to_jsonb(c)->>'tenant_phone' else null end))
    from public.contracts c where portal_private.resource_scope(actor,c.property_id,c.id)),'[]'),
   'payments',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'property_id',coalesce(t.property_id,c.property_id),'contract_id',t.contract_id,'due_id',t.payment_due_id,'date',t.transaction_date,'amount',t.amount,'net_amount',t.net_profit,'method',t.payment_method,'category',t.category,'flow',upper(t.transaction_type),'owner_charge',t.owner_charge,'maintenance_task_id',t.maintenance_task_id,'period_start',t.period_start,'period_end',t.period_end))
    from public.financial_transactions t left join public.contracts c on c.id=t.contract_id where account.role<>'BROKER' and portal_private.resource_scope(actor,coalesce(t.property_id,c.property_id),c.id)
     and (account.role<>'TENANT' or (upper(t.transaction_type)='INCOME' and (t.category='RENTAL_PAYMENT' or t.payment_due_id is not null)))),'[]'),
   'dues',coalesce((select jsonb_agg(to_jsonb(d)) from portal_private.payment_dues d join public.contracts c on c.id=d.contract_id where account.role<>'BROKER' and portal_private.resource_scope(actor,c.property_id,c.id)),'[]'),
   'ownership',coalesce((select jsonb_agg(to_jsonb(l)) from portal_private.owner_property_links l where l.owner_user_id=actor and account.role='OWNER'),'[]'),
   'maintenance',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'number',m.task_number,'property_id',m.property_id,'contract_id',m.contract_id,'unit_label',m.unit_number,'category',m.task_type,'description',m.description,'cost',m.cost_amount,'cost_bearer',m.cost_bearer,'cost_customer_id',m.cost_customer_id,'requested_by',m.requested_by,'status',coalesce(m.workflow_status,case lower(m.status) when 'completed' then 'completed' when 'cancelled' then 'cancelled' when 'in_progress' then 'in_progress' else 'pending' end),'created_at',m.created_at,'completed_at',m.completed_at,'preferred_visit_at',m.preferred_visit_at,'scheduled_at',m.scheduled_at,
    'history',coalesce((select jsonb_agg(jsonb_build_object('from',h.from_status,'to',h.to_status,'actor',h.actor_user_id,'note',h.note,'date',h.created_at) order by h.created_at) from portal_private.maintenance_history h where h.task_id=m.id),'[]'),
    'attachments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'filename',a.filename)) from portal_private.maintenance_attachments a where a.task_id=m.id),'[]')))
    from public.property_maintenance_tasks m where account.role<>'BROKER' and portal_private.resource_scope(actor,m.property_id,m.contract_id)),'[]'),
   'commissions',coalesce((select jsonb_agg(jsonb_build_object('contract_id',l.contract_id,'broker_user_id',l.broker_user_id,'number',c.contract_number,'closed_at',l.closed_at,'status',l.payout_status,'paid_at',l.paid_at,'type',coalesce(l.commission_type,a.commission_type),'rate',coalesce(l.commission_value,a.commission_value),'basis',coalesce(l.percentage_basis,a.percentage_basis),'contract_value',portal_private.contract_value(c.rent_amount,c.start_date,c.end_date),'annual_rent',c.rent_amount,'office_commission',coalesce(c.office_profit,0),
    'amount',case coalesce(l.commission_type,a.commission_type) when 'FIXED' then coalesce(l.commission_value,a.commission_value) else round((case coalesce(l.percentage_basis,a.percentage_basis) when 'OFFICE_COMMISSION' then coalesce(c.office_profit,0) else portal_private.contract_value(c.rent_amount,c.start_date,c.end_date) end)*coalesce(l.commission_value,a.commission_value)/100,2) end))
    from portal_private.broker_contract_links l join public.contracts c on c.id=l.contract_id join portal_private.broker_office_agreements a on a.id=l.agreement_id where account.role in ('ADMIN','CEO') or (account.role='BROKER' and l.broker_user_id=actor)),'[]'),
   'kpis',coalesce((select jsonb_agg(to_jsonb(k)||jsonb_build_object('custom_actual',coalesce((select sum(e.value) from portal_private.kpi_events e where e.kpi_id=k.id and e.event_date between k.period_start and k.period_end),0))) from portal_private.broker_kpis k where account.role in ('ADMIN','CEO') or (account.role='BROKER' and k.broker_user_id=actor)),'[]'),
   'customers',case when account.role in ('ADMIN','CEO') then coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'name',a.full_name,'role',a.role)) from portal_private.accounts a where a.is_active and a.role in ('TENANT','OWNER','BROKER')),'[]') else '[]'::jsonb end,
   'audit',case when account.role in ('ADMIN','CEO') then coalesce((select jsonb_agg(to_jsonb(a)) from (select * from portal_private.portal_audit order by created_at desc limit 100) a),'[]') else '[]'::jsonb end);
 end if;
 if operation='MAINTENANCE_CREATE' then
  if account.role not in ('TENANT','OWNER','ADMIN','CEO') then raise insufficient_privilege; end if;
  property:=(payload->>'property_id')::uuid;
  target:=nullif(payload->>'contract_id','')::uuid;
  if target is not null then select * into contract from public.contracts where id=target and property_id=property;
   if not found then raise exception 'Contract/property mismatch'; end if; end if;
  if not portal_private.resource_scope(actor,property,target) then raise insufficient_privilege; end if;
  if account.role='TENANT' and (contract.end_date<(now() at time zone 'Asia/Riyadh')::date or contract.start_date>(now() at time zone 'Asia/Riyadh')::date or lower(contract.status) not in ('active','ساري')) then raise exception 'Active lease required'; end if;
  insert into public.property_maintenance_tasks(task_number,property_id,property_name,contract_id,unit_number,task_type,description,cost_amount,status,workflow_status,requested_by,cost_bearer,cost_customer_id,preferred_visit_at)
   values('MNT-'||gen_random_uuid()::text,property,(select coalesce(to_jsonb(p)->>'property_name',to_jsonb(p)->>'title') from public.properties p where id=property),target,
    case when account.role='TENANT' then contract.unit_label else payload->>'unit_label' end,payload->>'category',payload->>'description',0,'Pending','pending',actor,
    case when account.role='OWNER' then 'owner' when account.role='TENANT' then 'tenant' else 'company' end,case when account.role in ('OWNER','TENANT') then actor else null end,nullif(payload->>'preferred_visit_at','')::timestamptz) returning id into target;
  return jsonb_build_object('id',target);
 end if;
 if operation in ('MAINTENANCE_TRANSITION','MAINTENANCE_QUOTE','ATTACH','ATTACHMENT') then
  target:=(payload->>'task_id')::uuid;
  select * into task from public.property_maintenance_tasks where id=target for update;
  if not found or account.role not in ('TENANT','OWNER','ADMIN','CEO') or not portal_private.resource_scope(actor,task.property_id,task.contract_id) then raise insufficient_privilege; end if;
  if account.role='TENANT' and operation<>'ATTACHMENT' and not exists(select 1 from public.contracts c where c.id=task.contract_id and lower(c.status) in ('active','ساري') and c.start_date<=(now() at time zone 'Asia/Riyadh')::date and c.end_date>=(now() at time zone 'Asia/Riyadh')::date) then raise insufficient_privilege using message='Lease history is read-only'; end if;
  if operation='ATTACHMENT' then
   select jsonb_build_object('path',a.object_path,'mime_type',a.mime_type,'filename',a.filename) into result from portal_private.maintenance_attachments a where a.task_id=target and a.id=(payload->>'attachment_id')::uuid;
   if result is null then raise insufficient_privilege; end if; return result;
  elsif operation='ATTACH' then
   if payload->>'object_path' not like target::text||'/'||actor::text||'/%' then raise insufficient_privilege; end if;
   insert into portal_private.maintenance_attachments(task_id,uploaded_by,object_path,filename,mime_type)
    values(target,actor,payload->>'object_path',payload->>'filename',payload->>'mime_type'); return jsonb_build_object('ok',true);
  elsif operation='MAINTENANCE_QUOTE' then
   if account.role not in ('ADMIN','CEO') or task.workflow_status<>'under_review' then raise insufficient_privilege; end if;
   customer:=nullif(payload->>'cost_customer_id','')::uuid;
   if payload->>'cost_bearer'<>'company' and not exists(select 1 from portal_private.accounts a where a.user_id=customer and a.is_active and lower(a.role)=payload->>'cost_bearer' and portal_private.resource_scope(customer,task.property_id,task.contract_id)) then raise exception 'Cost customer must be assigned'; end if;
   if (payload->>'cost')::numeric<0 then raise exception 'Invalid cost'; end if;
   update public.property_maintenance_tasks set cost_amount=(payload->>'cost')::numeric,cost_bearer=payload->>'cost_bearer',cost_customer_id=case when payload->>'cost_bearer'='company' then null else customer end where id=target;
  else
   perform set_config('portal.note',coalesce(payload->>'note',''),true);
   update public.property_maintenance_tasks set workflow_status=payload->>'status',scheduled_at=coalesce(nullif(payload->>'scheduled_at','')::timestamptz,scheduled_at) where id=target;
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if operation='PAYMENT_DOCUMENT' then
  target:=(payload->>'payment_id')::uuid;
  select jsonb_build_object('payment_id',t.id,'reference',t.id,'tenant_name',c.tenant_name,'unit_label',c.unit_label,'property_name',coalesce(to_jsonb(p)->>'property_name',to_jsonb(p)->>'title'),'amount',t.amount,'date',t.transaction_date,'method',t.payment_method,'period_start',coalesce(t.period_start,d.period_start),'period_end',coalesce(t.period_end,d.period_end)) into result
   from public.financial_transactions t join public.contracts c on c.id=t.contract_id join public.properties p on p.id=c.property_id left join portal_private.payment_dues d on d.id=t.payment_due_id
   where t.id=target and upper(t.transaction_type)='INCOME' and (t.category='RENTAL_PAYMENT' or d.id is not null) and account.role in ('TENANT','ADMIN','CEO') and portal_private.resource_scope(actor,c.property_id,c.id);
  if result is null then raise insufficient_privilege; end if;
  insert into portal_private.documents(account_id,kind,payment_id,snapshot) values(actor,'payment',target,result) returning * into document;
  return to_jsonb(document);
 end if;
 if operation='STATEMENT_DOCUMENT' then
  if account.role<>'OWNER' then raise insufficient_privilege; end if;
  -- Only server-computed, scoped statement snapshots are accepted by service RPC.
  insert into portal_private.documents(account_id,kind,snapshot) values(actor,'statement',payload) returning * into document;
  return to_jsonb(document);
 end if;
 if account.role not in ('ADMIN','CEO') then raise insufficient_privilege using message='Active executive required'; end if;
 if operation='CONTRACT_UNIT' then
  update public.contracts set unit_label=payload->>'unit_label',unit_details=payload->>'unit_details',owner_contact_visible=(payload->>'owner_contact_visible')::boolean where id=(payload->>'contract_id')::uuid;
 elsif operation='DUE_SAVE' then
  insert into portal_private.payment_dues(id,contract_id,kind,description,due_date,period_start,period_end,amount)
  values(coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()),(payload->>'contract_id')::uuid,payload->>'kind',payload->>'description',(payload->>'due_date')::date,(payload->>'period_start')::date,(payload->>'period_end')::date,(payload->>'amount')::numeric)
  on conflict(id) do update set description=excluded.description,due_date=excluded.due_date,period_start=excluded.period_start,period_end=excluded.period_end,amount=excluded.amount;
 elsif operation='PAYMENT_LINK' then
  select * into due from portal_private.payment_dues where id=(payload->>'due_id')::uuid;
  if not found then raise exception 'Due not found'; end if;
  update public.financial_transactions set payment_due_id=due.id,period_start=due.period_start,period_end=due.period_end
   where id=(payload->>'payment_id')::uuid and contract_id=due.contract_id and upper(transaction_type)='INCOME';
  if not found then raise exception 'Payment contract mismatch'; end if;
 elsif operation='OWNER_CHARGE' then
  update public.financial_transactions set owner_charge=(payload->>'owner_charge')::boolean where id=(payload->>'payment_id')::uuid and category<>'RENTAL_PAYMENT';
  if not found then raise exception 'Rental receipts cannot be deductions'; end if;
 elsif operation='COMMISSION_SAVE' then
  update portal_private.broker_contract_links set commission_type=payload->>'type',commission_value=(payload->>'value')::numeric,percentage_basis=payload->>'basis',payout_status=payload->>'payout_status',closed_at=nullif(payload->>'closed_at','')::timestamptz,
   paid_at=case when payload->>'payout_status'='paid' then coalesce(paid_at,now()) else null end where broker_user_id=(payload->>'broker_user_id')::uuid and contract_id=(payload->>'contract_id')::uuid;
  if not found then raise exception 'Assigned broker contract required'; end if;
 elsif operation='KPI_SAVE' then
  if not exists(select 1 from portal_private.accounts where user_id=(payload->>'broker_user_id')::uuid and role='BROKER' and is_active) then raise exception 'Active broker required'; end if;
  insert into portal_private.broker_kpis(id,broker_user_id,name,metric,target,period,period_start,period_end,weight)
   values(coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()),(payload->>'broker_user_id')::uuid,payload->>'name',payload->>'metric',(payload->>'target')::numeric,payload->>'period',(payload->>'period_start')::date,(payload->>'period_end')::date,nullif(payload->>'weight','')::numeric)
   on conflict(id) do update set name=excluded.name,metric=excluded.metric,target=excluded.target,period=excluded.period,period_start=excluded.period_start,period_end=excluded.period_end,weight=excluded.weight;
 elsif operation='KPI_EVENT' then
  insert into portal_private.kpi_events(kpi_id,value,event_date,note) values((payload->>'kpi_id')::uuid,(payload->>'value')::numeric,(payload->>'date')::date,payload->>'note');
 else raise exception 'Unknown operation'; end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.portal_workflow(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.portal_workflow(uuid,text,jsonb) to service_role;
-- Preserve the current administration body while recording the verified actor
-- for automatic before/after auditing of existing assignment operations.
do $$ declare definition text; marker text:='if not found then raise insufficient_privilege using message=''Active executive required''; end if;'; begin
 definition:=pg_get_functiondef('public.portal_admin(uuid,text,jsonb,uuid)'::regprocedure);
 if position(marker in definition)=0 then raise exception 'Unexpected portal_admin definition'; end if;
 definition:=replace(definition,marker,marker||E'\n perform set_config(''portal.actor'',actor::text,true);');
 execute definition;
end $$;
notify pgrst,'reload schema';
commit;
