-- Additive candidate. Configure the two verified account UUIDs in this session.
-- No production IDs or secrets are embedded in source.
begin;
create table portal_private.operations_approval_config(
 singleton boolean primary key default true check(singleton),
 assistant_enabled boolean not null default true,
 manager_id uuid not null references portal_private.accounts(user_id),
 final_id uuid not null references portal_private.accounts(user_id),
 check(manager_id<>final_id)
);
alter table portal_private.operations_approval_config enable row level security;
revoke all on portal_private.operations_approval_config from public,anon,authenticated,service_role;
insert into portal_private.operations_approval_config(manager_id,final_id)
values(nullif(current_setting('kohl.workflow_manager',true),'')::uuid,
       nullif(current_setting('kohl.workflow_final',true),'')::uuid);
do $$ begin
 if not exists(select 1 from portal_private.operations_approval_config c
 join portal_private.accounts m on m.user_id=c.manager_id and m.role='ADMIN' and m.is_active
 join portal_private.accounts f on f.user_id=c.final_id and f.role='CEO' and f.is_active)
 then raise exception 'Verify active manager ADMIN and final approver CEO before migration'; end if;
end $$;

alter table portal_private.internal_entries
 add column manager_reviewed_by uuid references portal_private.accounts(user_id),
 add column manager_reviewed_at timestamptz,
 add column manager_review_note text not null default '';
alter table portal_private.leasing_followups add column assistant_created_at timestamptz;
alter table portal_private.leasing_followups add column origin text not null default 'HUMAN'
 check(origin in ('HUMAN','LEASING_ASSISTANT'));

-- Preserve the deployed financial checks, but remove direct access to their old entry point.
alter function public.kohl_operations(text,jsonb) set schema portal_private;
alter function portal_private.kohl_operations(text,jsonb) rename to operations_core_v1;
revoke all on function portal_private.operations_core_v1(text,jsonb) from public,anon,authenticated,service_role;
alter function public.operations_document(uuid,text,jsonb) set schema portal_private;
alter function portal_private.operations_document(uuid,text,jsonb) rename to document_core_v1;
revoke all on function portal_private.document_core_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;

create function public.kohl_operations(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare who uuid:=auth.uid(); acct portal_private.accounts; cfg portal_private.operations_approval_config;
 e portal_private.internal_entries; result jsonb; target uuid; memo text; desired text;
 c portal_private.leasing_cases; task uuid; count_added integer:=0; prior portal_private.operations_replays;
begin
 select * into acct from portal_private.accounts where user_id=who and is_active for share;
 if not found or acct.role not in ('ADMIN','CEO','EMPLOYEE') then raise insufficient_privilege; end if;
 select * into cfg from portal_private.operations_approval_config where singleton for share;
 if not found then raise insufficient_privilege; end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise invalid_parameter_value; end if;
 if operation='WORKFLOW_INFO' then
  if payload<>'{}'::jsonb then raise invalid_parameter_value; end if;
  return jsonb_build_object('manager_id',cfg.manager_id,'final_id',cfg.final_id,
    'manager_name',(select full_name from portal_private.accounts where user_id=cfg.manager_id),
    'final_name',(select full_name from portal_private.accounts where user_id=cfg.final_id),
    'assistant_available',cfg.assistant_enabled and who=cfg.manager_id and acct.role='ADMIN');
 elsif operation='ENTRY_DECIDE' then
  if payload-array['id','status','note']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  target:=(payload->>'id')::uuid;memo:=btrim(coalesce(payload->>'note',''));desired:=payload->>'status';
  if memo='' or length(memo)>1000 or desired is null or desired not in ('APPROVED','REJECTED') then raise invalid_parameter_value; end if;
  -- Same advisory key as core decision path; one stage transition per entry.
  perform pg_advisory_xact_lock(hashtextextended(target::text,0));
  select * into e from portal_private.internal_entries where id=target for update;
  if not found then raise insufficient_privilege; end if;
  if e.status<>'PENDING' then raise exception 'Decision immutable' using errcode='PT409'; end if;
  if e.manager_reviewed_at is null then
   if who<>cfg.manager_id or acct.role<>'ADMIN' then raise insufficient_privilege; end if;
   if exists(select 1 from portal_private.operations_documents where entry_id=target and status='UPLOADING'
             and created_at>now()-interval '15 minutes') then raise exception 'Upload in progress' using errcode='PT409'; end if;
   if desired='REJECTED' then return portal_private.operations_core_v1(operation,payload); end if;
   update portal_private.internal_entries set manager_reviewed_by=who,manager_reviewed_at=now(),manager_review_note=memo where id=target;
   insert into portal_private.operations_history(entity_id,case_id,actor,action,note,changes)
    values(target,e.case_id,who,'ENTRY_DECIDE',memo,jsonb_build_object('stage','MANAGER_REVIEW','before',to_jsonb(e),'after',(select to_jsonb(x) from portal_private.internal_entries x where id=target)));
   return jsonb_build_object('saved',true,'awaiting_final',true);
  end if;
  if who<>cfg.final_id or acct.role<>'CEO' or e.manager_reviewed_by<>cfg.manager_id then raise insufficient_privilege; end if;
  return portal_private.operations_core_v1(operation,payload);
 elsif operation='ASSISTANT_PLAN' then
  if not cfg.assistant_enabled or who<>cfg.manager_id or acct.role<>'ADMIN' then raise insufficient_privilege; end if;
  if payload-array['id']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  target:=(payload->>'id')::uuid;if target is null then raise invalid_parameter_value; end if;
  -- Serializes all plan runs by this owner, not only retries of the same request.
  perform pg_advisory_xact_lock(hashtextextended(who::text||':assistant-plan',0));
  select * into prior from portal_private.operations_replays where id=target;
  if found then
   if prior.actor<>who or prior.operation<>operation or prior.payload<>payload then raise exception 'Replay conflict' using errcode='PT409'; end if;
   return prior.result;
  end if;
  for c in select * from portal_private.leasing_cases lc where lc.assignee_id=who and lc.stage='CONFIRMED'
   and lc.end_date<=(now() at time zone 'Asia/Riyadh')::date+
        case lc.kind when 'DAILY' then 3 when 'MONTHLY' then 7 else 30 end
   and not exists(select 1 from portal_private.leasing_followups f where f.case_id=lc.id
      and (f.completed_at is null or (f.origin='LEASING_ASSISTANT' and (f.assistant_created_at at time zone 'Asia/Riyadh')::date=(now() at time zone 'Asia/Riyadh')::date)))
   order by lc.end_date,lc.id limit 20
  loop
   task:=gen_random_uuid();
   insert into portal_private.leasing_followups(id,case_id,assignee_id,title,due_at,origin,assistant_created_at)
    values(task,c.id,who,case c.kind when 'DAILY' then 'تنسيق المغادرة أو التمديد' else 'متابعة التجديد أو الإخلاء' end,now()+interval '1 hour','LEASING_ASSISTANT',now());
   insert into portal_private.operations_history(entity_id,case_id,actor,action,note,changes)
    values(task,c.id,who,'ASSISTANT_PLAN','أخصائي التأجير — مساعد افتراضي',jsonb_build_object('source','LEASING_ASSISTANT','performed_by',who));
   count_added:=count_added+1;
  end loop;
  result:=jsonb_build_object('saved',true,'created',count_added);
  insert into portal_private.operations_replays values(target,who,operation,payload,result);
  return result;
 end if;
 result:=portal_private.operations_core_v1(operation,payload);
 if operation='LIST' then
  result:=result||jsonb_build_object('workflow',public.kohl_operations('WORKFLOW_INFO','{}'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.kohl_operations(text,jsonb) from public,anon;
grant execute on function public.kohl_operations(text,jsonb) to authenticated;

-- Freeze documents at first review, before final monetary approval.
create function public.operations_document(actor uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; reviewed timestamptz;
begin
 if operation in ('RESERVE','FINISH') then
  target:=case when operation='RESERVE' then (payload->>'entry_id')::uuid
   else (select entry_id from portal_private.operations_documents where id=(payload->>'id')::uuid) end;
  select manager_reviewed_at into reviewed from portal_private.internal_entries where id=target for update;
  if reviewed is not null then raise exception 'Documents frozen after manager review' using errcode='PT409'; end if;
 end if;
 return portal_private.document_core_v1(actor,operation,payload);
end $$;
revoke all on function public.operations_document(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.operations_document(uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
