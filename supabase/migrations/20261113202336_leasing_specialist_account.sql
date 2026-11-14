-- Separate, session-bound leasing identity. Existing case assignments and audits stay intact.
begin;
create role kohl_leasing nologin noinherit;
grant kohl_leasing to authenticator;
grant usage on schema public,auth to kohl_leasing;
alter table portal_private.accounts drop constraint accounts_role_check;
alter table portal_private.accounts add constraint accounts_role_check
 check(role in ('ADMIN','CEO','HR','EMPLOYEE','BROKER','OWNER','TENANT','LEASING'));
create table portal_private.leasing_specialist_config(
 singleton boolean primary key default true check(singleton),
 specialist_id uuid unique references portal_private.accounts(user_id),
 enabled boolean not null default true
);
insert into portal_private.leasing_specialist_config(singleton) values(true);
create table portal_private.leasing_delegations(
 child_session uuid primary key references auth.sessions(id) on delete cascade,
 parent_session uuid not null references auth.sessions(id) on delete cascade,
 owner_id uuid not null references portal_private.accounts(user_id),
 specialist_id uuid not null references portal_private.accounts(user_id),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create table portal_private.leasing_specialist_leads(
 lead_id uuid primary key references public.crm_leads(id),
 specialist_id uuid not null references portal_private.accounts(user_id)
);
do $$ declare t text; begin
 foreach t in array array['leasing_specialist_config','leasing_delegations','leasing_specialist_leads'] loop
  execute format('alter table portal_private.%I enable row level security',t);
  execute format('revoke all on portal_private.%I from public,anon,authenticated,service_role,kohl_leasing',t);
 end loop;
end $$;
-- The old admin assistant is retired, without moving any of its prior work.
update portal_private.operations_approval_config set assistant_enabled=false;

create function public.leasing_switch_admin(actor uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare manager uuid; child uuid; acct portal_private.accounts; sid uuid; pid uuid;
begin
 select c.manager_id into manager from portal_private.operations_approval_config c where singleton for share;
 select * into acct from portal_private.accounts where user_id=actor and is_active and role='ADMIN' for share;
 if not found or actor is distinct from manager then raise insufficient_privilege; end if;
 select specialist_id into child from portal_private.leasing_specialist_config where singleton and enabled for update;
 if not found then raise insufficient_privilege; end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise invalid_parameter_value; end if;
 if operation='REGISTER' then
  if payload-array['id']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  if child is null then
   child:=(payload->>'id')::uuid;
   if not exists(select 1 from auth.users where id=child and role='kohl_leasing') then raise insufficient_privilege; end if;
   insert into portal_private.accounts(user_id,full_name,mobile,role,is_active,created_by,invitation_status)
    values(child,'أخصائي التأجير',acct.mobile,'LEASING',true,actor,'SENT');
   update portal_private.leasing_specialist_config set specialist_id=child where singleton;
  end if;
 elsif operation='BEGIN' then
  if payload-array['child_session','parent_session']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  sid:=(payload->>'child_session')::uuid;pid:=(payload->>'parent_session')::uuid;
  if not exists(select 1 from auth.sessions where id=sid and user_id=child)
    or not exists(select 1 from auth.sessions where id=pid and user_id=actor)
    or not exists(select 1 from portal_private.accounts a join auth.users u on u.id=a.user_id
                  where a.user_id=child and a.is_active and a.role='LEASING' and u.role='kohl_leasing') then raise insufficient_privilege; end if;
  insert into portal_private.leasing_delegations(child_session,parent_session,owner_id,specialist_id,expires_at)
   values(sid,pid,actor,child,now()+interval '4 hours');
  insert into portal_private.operations_history(entity_id,actor,action,note,changes)
   values(child,actor,'LEASING_SWITCH_IN','الدخول إلى حساب أخصائي التأجير',jsonb_build_object('specialist_id',child,'session_id',sid));
 elsif operation='END' then
  if payload-array['child_session']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  sid:=(payload->>'child_session')::uuid;
  delete from portal_private.leasing_delegations where child_session=sid and owner_id=actor and specialist_id=child;
  insert into portal_private.operations_history(entity_id,actor,action,note,changes)
   values(child,actor,'LEASING_SWITCH_OUT','العودة من حساب أخصائي التأجير',jsonb_build_object('specialist_id',child,'session_id',sid));
 elsif operation<>'STATE' or payload<>'{}'::jsonb then raise invalid_parameter_value;
 end if;
 return jsonb_build_object('owner_id',actor,'owner_name',acct.full_name,'specialist_id',child);
end $$;
revoke all on function public.leasing_switch_admin(uuid,text,jsonb) from public,anon,authenticated,kohl_leasing;
grant execute on function public.leasing_switch_admin(uuid,text,jsonb) to service_role;

create function portal_private.leasing_scope() returns portal_private.leasing_delegations
language plpgsql security definer set search_path='' as $$
declare d portal_private.leasing_delegations;
begin
 select x.* into d from portal_private.leasing_delegations x
 join portal_private.leasing_specialist_config c on c.specialist_id=x.specialist_id and c.enabled
 join portal_private.operations_approval_config w on w.manager_id=x.owner_id
 join portal_private.accounts a on a.user_id=x.specialist_id and a.role='LEASING' and a.is_active
 join portal_private.accounts o on o.user_id=x.owner_id and o.role='ADMIN' and o.is_active
 join auth.sessions s on s.id=x.child_session and s.user_id=x.specialist_id
 join auth.sessions p on p.id=x.parent_session and p.user_id=x.owner_id
 where x.specialist_id=auth.uid() and x.expires_at>now()
 and x.child_session=(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id')::uuid;
 if not found then raise insufficient_privilege; end if;
 return d;
end $$;
revoke all on function portal_private.leasing_scope() from public,anon,authenticated,service_role,kohl_leasing;
create function public.leasing_profile() returns jsonb
language plpgsql security definer set search_path='' as $$
declare d portal_private.leasing_delegations; a portal_private.accounts;
begin
 d:=portal_private.leasing_scope();
 select * into a from portal_private.accounts where user_id=d.specialist_id;
 return jsonb_build_object('account',jsonb_build_object('id',a.user_id,'name',a.full_name,'role',a.role,'phone',a.mobile,'history_only',false),
  'leasing_operator',jsonb_build_object('name',(select full_name from portal_private.accounts where user_id=d.owner_id),'expires_at',d.expires_at),
  'owners','[]'::jsonb,'leases','[]'::jsonb,'broker_contracts','[]'::jsonb);
end $$;
revoke all on function public.leasing_profile() from public,anon,authenticated,service_role;
grant execute on function public.leasing_profile() to kohl_leasing;

-- Derive a private copy of the reviewed core, with a narrower role and explicit new-lead scope.
-- The original core and financial approval wrapper are not modified.
do $$ declare source text; begin
 select pg_get_functiondef('portal_private.operations_core_v1(text,jsonb)'::regprocedure) into source;
 if position('acct.role not in (''ADMIN'',''CEO'',''EMPLOYEE'')' in source)=0
    or position('assigned_agent_id=acct.employee_id' in source)=0 then
  raise exception 'Unexpected operations core; review before migrating';
 end if;
 source:=replace(source,'operations_core_v1','leasing_core_v1');
 source:=replace(source,'acct.role not in (''ADMIN'',''CEO'',''EMPLOYEE'')','acct.role <> ''LEASING''');
 source:=replace(source,'role in (''ADMIN'',''CEO'',''EMPLOYEE'')','role = ''LEASING''');
 source:=replace(source,'assigned_agent_id=acct.employee_id','id in (select lead_id from portal_private.leasing_specialist_leads where specialist_id=who)');
 execute source;
end $$;
revoke all on function portal_private.leasing_core_v1(text,jsonb) from public,anon,authenticated,service_role,kohl_leasing;

create function public.leasing_operations(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare d portal_private.leasing_delegations; result jsonb; target uuid; prior portal_private.operations_replays;
 c portal_private.leasing_cases; task uuid; count_added integer:=0;
begin
 d:=portal_private.leasing_scope();
 if payload is null or jsonb_typeof(payload)<>'object' then raise invalid_parameter_value; end if;
 if operation is null or operation not in ('LIST','CONTACT_CREATE','CASE_CREATE','CASE_UPDATE','FOLLOWUP_ADD','FOLLOWUP_DONE','ASSISTANT_PLAN') then raise insufficient_privilege; end if;
 -- Linking or unlinking a legal contract remains an administrative action.
 if operation='CASE_UPDATE' and (payload->>'contract_id')::uuid is distinct from
   (select contract_id from portal_private.leasing_cases where id=(payload->>'id')::uuid and assignee_id=d.specialist_id)
 then raise insufficient_privilege; end if;
 if operation='CONTACT_CREATE' then
  if payload-array['id','name','phone','source']<>'{}'::jsonb
    or coalesce(length(btrim(payload->>'name')),0) not between 1 and 160
    or coalesce(payload->>'phone','') !~ '^05[0-9]{8}$'
    or coalesce(length(btrim(payload->>'source')),0) not between 1 and 50 then raise invalid_parameter_value; end if;
  target:=(payload->>'id')::uuid;if target is null then raise invalid_parameter_value; end if;
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into prior from portal_private.operations_replays where id=target;
  if found then
   if prior.actor<>d.specialist_id or prior.operation<>operation or prior.payload<>payload then raise exception 'Replay conflict' using errcode='PT409'; end if;
   return prior.result;
  end if;
  insert into public.crm_leads(id,lead_code,name,phone,source,lead_type)
   values(target,'LS-'||target::text,btrim(payload->>'name'),payload->>'phone',btrim(payload->>'source'),'TENANT');
  insert into portal_private.leasing_specialist_leads values(target,d.specialist_id);
  result:=jsonb_build_object('saved',true,'id',target);
  insert into portal_private.operations_replays values(target,d.specialist_id,operation,payload,result);
  insert into portal_private.operations_history(entity_id,actor,action,note)
   values(target,d.specialist_id,operation,'إضافة عميل تأجير جديد');
 elsif operation='ASSISTANT_PLAN' then
  if payload-array['id']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  target:=(payload->>'id')::uuid;if target is null then raise invalid_parameter_value; end if;
  perform pg_advisory_xact_lock(hashtextextended(d.specialist_id::text||':assistant-plan',0));
  select * into prior from portal_private.operations_replays where id=target;
  if found then
   if prior.actor<>d.specialist_id or prior.operation<>operation or prior.payload<>payload then raise exception 'Replay conflict' using errcode='PT409'; end if;
   return prior.result;
  end if;
  for c in select * from portal_private.leasing_cases lc where lc.assignee_id=d.specialist_id and lc.stage='CONFIRMED'
   and lc.end_date<=(now() at time zone 'Asia/Riyadh')::date+case lc.kind when 'DAILY' then 3 when 'MONTHLY' then 7 else 30 end
   and not exists(select 1 from portal_private.leasing_followups f where f.case_id=lc.id
    and (f.completed_at is null or (f.origin='LEASING_ASSISTANT' and (f.assistant_created_at at time zone 'Asia/Riyadh')::date=(now() at time zone 'Asia/Riyadh')::date)))
   order by lc.end_date,lc.id limit 20 loop
   task:=gen_random_uuid();
   insert into portal_private.leasing_followups(id,case_id,assignee_id,title,due_at,origin,assistant_created_at)
    values(task,c.id,d.specialist_id,case c.kind when 'DAILY' then 'تنسيق المغادرة أو التمديد' else 'متابعة التجديد أو الإخلاء' end,now()+interval '1 hour','LEASING_ASSISTANT',now());
   insert into portal_private.operations_history(entity_id,case_id,actor,action,note)
    values(task,c.id,d.specialist_id,operation,'أخصائي التأجير — مساعد افتراضي');
   count_added:=count_added+1;
  end loop;
  result:=jsonb_build_object('saved',true,'created',count_added);
  insert into portal_private.operations_replays values(target,d.specialist_id,operation,payload,result);
 else
  result:=portal_private.leasing_core_v1(operation,payload);
 end if;
 if operation='LIST' then
  result:=result||jsonb_build_object('entries','[]'::jsonb,'dues','[]'::jsonb,'documents','[]'::jsonb,'exports','[]'::jsonb,'contracts','[]'::jsonb,
   'workflow',jsonb_build_object('manager_id',d.owner_id,'final_id',(select final_id from portal_private.operations_approval_config),
    'manager_name',(select full_name from portal_private.accounts where user_id=d.owner_id),
    'final_name',(select full_name from portal_private.accounts where user_id=(select final_id from portal_private.operations_approval_config)),
    'assistant_available',true));
 else
  -- Only rows written in this transaction; preserve historical attribution.
  update portal_private.operations_history set changes=changes||jsonb_build_object('operator_id',d.owner_id,'specialist_id',d.specialist_id,'session_id',d.child_session)
   where actor=d.specialist_id and action=operation and created_at=now();
 end if;
 return result;
end $$;
revoke all on function public.leasing_operations(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.leasing_operations(text,jsonb) to kohl_leasing;
notify pgrst,'reload schema';
commit;
