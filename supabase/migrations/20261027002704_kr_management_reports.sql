-- Management visibility replaces report approval. No global roles are promoted.
begin;
set local lock_timeout='5s';
alter table portal_private.kr_daily_reports drop constraint kr_daily_reports_status_check;
alter table portal_private.kr_daily_reports add constraint kr_daily_reports_status_check
 check(status in ('DRAFT','RETURNED','PENDING_APPROVAL','APPROVED','PUBLISHED'));
alter table portal_private.kr_daily_reports add column published_at timestamptz,
 add column scheduled_at timestamptz;
alter table portal_private.kr_report_revisions alter column actor_id drop not null;

create table portal_private.kr_manager_access (
 user_id uuid primary key references auth.users(id), granted_by uuid not null references auth.users(id),
 granted_at timestamptz not null default now()
);
create table portal_private.kr_manager_access_events (
 id bigint generated always as identity primary key, actor_id uuid not null references auth.users(id),
 target_id uuid not null references auth.users(id), enabled boolean not null, created_at timestamptz not null default now()
);
alter table portal_private.kr_manager_access enable row level security;
alter table portal_private.kr_manager_access_events enable row level security;
revoke all on portal_private.kr_manager_access,portal_private.kr_manager_access_events from public,anon,authenticated;
grant select,insert,delete on portal_private.kr_manager_access to service_role;
grant select,insert on portal_private.kr_manager_access_events to service_role;
grant usage,select on sequence portal_private.kr_manager_access_events_id_seq to service_role;

create function public.kr_report_access(actor uuid, operation text, payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare account portal_private.accounts; target_id uuid; grant_enabled boolean; already_granted boolean;
begin
 select * into account from portal_private.accounts a where a.user_id=actor and a.is_active;
 if operation='CHECK' then
  return to_jsonb(account.user_id is not null and (account.role in ('ADMIN','CEO') or
   (account.role in ('HR','EMPLOYEE') and exists(select 1 from portal_private.kr_manager_access g where g.user_id=actor))));
 end if;
 if account.user_id is null or account.role not in ('ADMIN','CEO') then raise exception 'Executive required' using errcode='42501'; end if;
 if operation='LIST' then return coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',a.full_name,'role',a.role,'active',a.is_active,'enabled',g.user_id is not null) order by a.full_name,a.user_id)
  from portal_private.accounts a left join portal_private.kr_manager_access g on g.user_id=a.user_id where a.role in ('HR','EMPLOYEE')),'[]'::jsonb); end if;
 if operation<>'SET' then raise exception 'Unsupported access operation'; end if;
 target_id:=(payload->>'user_id')::uuid; grant_enabled:=(payload->>'enabled')::boolean;
 if target_id is null or grant_enabled is null then raise exception 'Account and access flag required'; end if;
 if not exists(select 1 from portal_private.accounts a where a.user_id=target_id and a.role in ('HR','EMPLOYEE') and (a.is_active or not grant_enabled)) then
  raise exception 'Existing internal account required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kr:access:'||target_id::text,0));
 already_granted:=exists(select 1 from portal_private.kr_manager_access g where g.user_id=target_id);
 if already_granted is distinct from grant_enabled then
  if grant_enabled then insert into portal_private.kr_manager_access(user_id,granted_by) values(target_id,actor);
  else delete from portal_private.kr_manager_access g where g.user_id=target_id; end if;
  insert into portal_private.kr_manager_access_events(actor_id,target_id,enabled) values(actor,target_id,grant_enabled);
 end if;
 return jsonb_build_object('user_id',target_id,'enabled',grant_enabled);
end $$;
revoke all on function public.kr_report_access(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.kr_report_access(uuid,text,jsonb) to service_role;

create function portal_private.kr_sync_plan(p_report_id uuid,p_day date,p_plan jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare item jsonb; assignee uuid; matches integer;
begin
 perform 1 from public.kr_agenda_tasks t where t.report_id=p_report_id for update;
 update public.kr_agenda_tasks t set is_current=false where t.report_id=p_report_id and not exists
  (select 1 from jsonb_array_elements(p_plan) a where (a->>'id')::uuid=t.action_id);
 for item in select value from jsonb_array_elements(p_plan) loop
  if timezone('Asia/Riyadh',(item->>'due_at')::timestamptz)::date<>p_day+1 then raise exception 'Next-day date required'; end if;
  select count(*),(array_agg(a.user_id))[1] into matches,assignee from portal_private.accounts a
   where a.is_active and a.role in ('ADMIN','CEO','EMPLOYEE') and a.full_name=item->>'owner';
  if matches<>1 then assignee:=null; end if;
  insert into public.kr_agenda_tasks as prior_task(report_id,action_id,action,contact,owner,assigned_user_id,due_at,indicator)
  values(p_report_id,(item->>'id')::uuid,item->>'action',item->>'contact',item->>'owner',assignee,(item->>'due_at')::timestamptz,item->>'indicator')
  on conflict(report_id,action_id) do update set
   action=excluded.action,contact=excluded.contact,owner=excluded.owner,assigned_user_id=excluded.assigned_user_id,due_at=excluded.due_at,indicator=excluded.indicator,is_current=true,
   status=case when prior_task.is_current and
    row(prior_task.action,prior_task.contact,prior_task.owner,prior_task.assigned_user_id,prior_task.due_at,prior_task.indicator)
    is not distinct from row(excluded.action,excluded.contact,excluded.owner,excluded.assigned_user_id,excluded.due_at,excluded.indicator)
    then prior_task.status else 'PENDING' end;
 end loop;
end $$;
revoke all on function portal_private.kr_sync_plan(uuid,date,jsonb) from public,anon,authenticated;
grant execute on function portal_private.kr_sync_plan(uuid,date,jsonb) to service_role;

create or replace function public.kr_workflow(actor uuid, operation text, payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare account portal_private.accounts; r portal_private.kr_daily_reports; cfg portal_private.kr_schedule;
 day date; item jsonb; prior portal_private.kr_imports; event uuid; actor_name text;
 current_day date:=timezone('Asia/Riyadh',now())::date;
begin
 if actor is not null then
  select * into account from portal_private.accounts a where a.user_id=actor and a.is_active;
  if account.user_id is null then raise exception 'Active account required' using errcode='42501'; end if;
  if operation in ('GET','HISTORY','RECENT','QUEUE','SCHEDULE_GET') then
   if public.kr_report_access(actor,'CHECK','{}') is distinct from 'true'::jsonb then raise exception 'Management report access required' using errcode='42501'; end if;
  elsif account.role not in ('ADMIN','CEO') then raise exception 'Executive required' using errcode='42501'; end if;
  actor_name:=account.full_name;
 elsif operation not in ('SCHEDULE_RUN','SCHEDULE_GET','SCHEDULE_READY') then raise exception 'Actor required' using errcode='42501';
 else actor_name:='إعداد آلي مجدول'; end if;
 if operation='SCHEDULE_GET' then
  select * into cfg from portal_private.kr_schedule s where s.id;
  return jsonb_build_object('enabled',cfg.enabled,'report_time',cfg.approval_time,'approval_time',cfg.approval_time,'timezone',cfg.timezone);
 end if;
 if operation='SCHEDULE_READY' then
  select * into cfg from portal_private.kr_schedule s where s.id;
  return jsonb_build_object('ready',cfg.enabled and timezone('Asia/Riyadh',now())::time>=cfg.approval_time and not exists
   (select 1 from portal_private.kr_daily_reports d where d.report_date=current_day and d.scheduled_at is not null));
 end if;
 if operation='SCHEDULE_SAVE' then
  update portal_private.kr_schedule s set enabled=(payload->>'enabled')::boolean,
   approval_time=coalesce(payload->>'report_time',payload->>'approval_time')::time,updated_at=now() where s.id;
  return public.kr_workflow(actor,'SCHEDULE_GET','{}');
 end if;
 if operation='QUEUE' then return '[]'::jsonb; end if;
 if operation='RECENT' then return coalesce((select jsonb_agg(v) from
  (select d.report_date,d.updated_at from portal_private.kr_daily_reports d order by d.report_date desc limit 60) v),'[]'::jsonb); end if;
 day:=(payload->>'report_date')::date;
 if day is null then raise exception 'Report date required'; end if;
 if operation='HISTORY' then
  select jsonb_build_object('report',v.report_snapshot,'agenda',v.agenda_snapshot,'reason',v.reason,'reopened_by',v.actor_name,'reopened_at',v.created_at)
  into item from portal_private.kr_report_revisions v join portal_private.kr_daily_reports d on d.id=v.report_id
  where d.report_date=day and v.revision=(payload->>'revision')::integer;
  if not found then raise exception 'Archived revision not found' using errcode='P0002'; end if; return item;
 end if;
 if operation='GET' then
  select * into r from portal_private.kr_daily_reports d where d.report_date=day;
  if not found then return 'null'::jsonb; end if;
  return to_jsonb(r)||jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from portal_private.kr_report_events e where e.report_id=r.id),'[]'),
   'previous_versions',coalesce((select jsonb_agg(v order by v.revision desc) from
    (select v0.revision,v0.report_status,v0.reason,v0.actor_name,v0.created_at from portal_private.kr_report_revisions v0 where v0.report_id=r.id) v),'[]'));
 end if;
 if operation not in ('PREPARE','SAVE','IMPORT','SCHEDULE_RUN') then raise exception 'Approval workflow removed'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kr:'||day::text,0));
 select * into r from portal_private.kr_daily_reports d where d.report_date=day for update;
 if operation='IMPORT' then
  event:=(payload->>'event_id')::uuid;
  if event is null or length(payload->>'digest')<>64 then raise exception 'Import identity required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kr:import:'||event::text,0));
  select * into prior from portal_private.kr_imports i where i.event_id=event;
  if found then
   if prior.digest is distinct from payload->>'digest' or prior.report_id is distinct from r.id then raise exception 'Import event changed' using errcode='40001'; end if;
   return to_jsonb(r);
  end if;
 end if;
 if operation='SCHEDULE_RUN' then
  select * into cfg from portal_private.kr_schedule s where s.id;
  if not cfg.enabled or day<>current_day or timezone('Asia/Riyadh',now())::time<cfg.approval_time then return jsonb_build_object('skipped',true); end if;
  if r.id is not null and r.scheduled_at is not null then return to_jsonb(r); end if;
 elsif r.id is not null and (payload->>'revision')::integer is distinct from r.revision then raise exception 'Report changed; reload' using errcode='40001'; end if;
 if r.id is null then
  if operation='SAVE' then raise exception 'Report not found' using errcode='P0002'; end if;
  insert into portal_private.kr_daily_reports(report_date,content,facts,prepared_by,prepared_name,status,published_at,scheduled_at)
  values(day,payload->'content',payload->'facts',actor,actor_name,'PUBLISHED',now(),case when operation='SCHEDULE_RUN' then now() end) returning * into r;
 else
  perform 1 from public.kr_agenda_tasks t where t.report_id=r.id for update;
  insert into portal_private.kr_report_revisions(report_id,revision,report_status,report_snapshot,agenda_snapshot,actor_id,actor_name,reason)
  values(r.id,r.revision,r.status,to_jsonb(r),coalesce((select jsonb_agg(to_jsonb(t) order by t.due_at,t.id) from public.kr_agenda_tasks t where t.report_id=r.id),'[]'),actor,actor_name,
   case operation when 'SAVE' then 'حفظ تعديلات التقرير' when 'IMPORT' then 'استيراد محتوى التقرير' when 'PREPARE' then 'تحديث لقطة المصادر' else 'النشر اليومي المجدول' end)
  on conflict(report_id,revision) do nothing;
  update portal_private.kr_daily_reports d set
   content=case when operation='SCHEDULE_RUN' then d.content else payload->'content' end,
   facts=case when operation in ('SCHEDULE_RUN','SAVE') then d.facts else payload->'facts' end,
   prepared_by=case when actor is null then d.prepared_by else actor end,
   prepared_name=case when actor is null then d.prepared_name else actor_name end,
   status='PUBLISHED',published_at=now(),submitted_at=null,approved_by=null,approved_name=null,approved_at=null,return_note=null,
   scheduled_at=case when operation='SCHEDULE_RUN' then now() else d.scheduled_at end,
   revision=d.revision+1,updated_at=now() where d.id=r.id returning * into r;
 end if;
 perform portal_private.kr_sync_plan(r.id,day,coalesce(r.content->'tomorrow','[]'::jsonb));
 if operation='IMPORT' then insert into portal_private.kr_imports(event_id,report_id,digest) values(event,r.id,payload->>'digest'); end if;
 insert into portal_private.kr_report_events(report_id,actor_id,actor_name,action,revision) values(r.id,actor,actor_name,operation,r.revision);
 return to_jsonb(r);
end $$;
revoke all on function public.kr_workflow(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.kr_workflow(uuid,text,jsonb) to service_role;
commit;
