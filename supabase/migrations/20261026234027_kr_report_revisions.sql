-- Reopen reports of any date while retaining approved snapshots and task history.
begin;
set local lock_timeout='5s';
create table portal_private.kr_report_revisions (
 id bigint generated always as identity primary key,
 report_id uuid not null references portal_private.kr_daily_reports(id),
 revision integer not null, report_status text not null,
 report_snapshot jsonb not null, agenda_snapshot jsonb not null,
 actor_id uuid not null references auth.users(id), actor_name text not null,
 reason text not null check(length(btrim(reason)) between 1 and 2000),
 created_at timestamptz not null default now(), unique(report_id,revision)
);
alter table portal_private.kr_report_revisions enable row level security;
revoke all on portal_private.kr_report_revisions from public,anon,authenticated;
grant select,insert on portal_private.kr_report_revisions to service_role;
grant usage,select on sequence portal_private.kr_report_revisions_id_seq to service_role;
-- Retire removed plan items without deleting historical/completed tasks.
alter table public.kr_agenda_tasks add column is_current boolean not null default true;
drop policy kr_agenda_read on public.kr_agenda_tasks;
drop policy kr_agenda_complete on public.kr_agenda_tasks;
create policy kr_agenda_read on public.kr_agenda_tasks for select to authenticated
 using(is_current and (portal_private.is_executive() or assigned_user_id=(select auth.uid())));
create policy kr_agenda_complete on public.kr_agenda_tasks for update to authenticated
 using(is_current and (portal_private.is_executive() or assigned_user_id=(select auth.uid())))
 with check(is_current and (portal_private.is_executive() or assigned_user_id=(select auth.uid())));

create or replace function public.kr_workflow(actor uuid, operation text, payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare account portal_private.accounts; r portal_private.kr_daily_reports; cfg portal_private.kr_schedule;
 day date; item jsonb; assignee uuid; matches integer; prior portal_private.kr_imports; event uuid;
 actor_name text; current_day date:=timezone('Asia/Riyadh',now())::date;
begin
 if actor is not null then
  select * into account from portal_private.accounts where user_id=actor and is_active and role in ('ADMIN','CEO');
  if not found then raise exception 'Executive required' using errcode='42501'; end if;
  actor_name:=account.full_name;
 elsif operation not in ('SCHEDULE_RUN','SCHEDULE_GET','SCHEDULE_READY') then raise exception 'Actor required' using errcode='42501';
 else actor_name:='إعداد آلي مجدول'; end if;
 if operation='SCHEDULE_GET' then return (select to_jsonb(s) from portal_private.kr_schedule s where id); end if;
 if operation='SCHEDULE_READY' then
  select * into cfg from portal_private.kr_schedule where id;
  return jsonb_build_object('ready',cfg.enabled and timezone('Asia/Riyadh',now())::time>=cfg.approval_time and not exists(select 1 from portal_private.kr_daily_reports where report_date=current_day and status<>'DRAFT'));
 end if;
 if operation='SCHEDULE_SAVE' then
  update portal_private.kr_schedule set enabled=(payload->>'enabled')::boolean,approval_time=(payload->>'approval_time')::time,updated_at=now() where id returning * into cfg;
  return to_jsonb(cfg);
 end if;
 if operation='QUEUE' then return coalesce((select jsonb_agg(v) from (select id,report_date,status,revision from portal_private.kr_daily_reports where status='PENDING_APPROVAL' order by report_date desc limit 60) v),'[]'); end if;
 day:=(payload->>'report_date')::date;
 if day is null then raise exception 'Report date required'; end if;
 if operation='HISTORY' then
  select jsonb_build_object('report',v.report_snapshot,'agenda',v.agenda_snapshot,'reason',v.reason,'reopened_by',v.actor_name,'reopened_at',v.created_at)
  into item from portal_private.kr_report_revisions v join portal_private.kr_daily_reports d on d.id=v.report_id
  where d.report_date=day and v.revision=(payload->>'revision')::integer;
  if not found then raise exception 'Archived revision not found' using errcode='P0002'; end if;
  return item;
 end if;
 if operation='GET' then
  select * into r from portal_private.kr_daily_reports where report_date=day;
  if not found then return 'null'; end if;
  return to_jsonb(r)||jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from portal_private.kr_report_events e where report_id=r.id),'[]'),
   'previous_versions',coalesce((select jsonb_agg(v order by v.revision desc) from
    (select v0.revision,v0.report_status,v0.reason,v0.actor_name,v0.created_at from portal_private.kr_report_revisions v0 where v0.report_id=r.id) v),'[]'));
 end if;
 perform pg_advisory_xact_lock(hashtextextended('kr:'||day::text,0));
 select * into r from portal_private.kr_daily_reports where report_date=day for update;
 if operation='IMPORT' then
  event:=(payload->>'event_id')::uuid;
  if event is null or length(payload->>'digest')<>64 then raise exception 'Import identity required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('kr:import:'||event::text,0));
  select * into prior from portal_private.kr_imports where event_id=event;
  if found then
   if prior.digest is distinct from payload->>'digest' or prior.report_id is distinct from r.id then raise exception 'Import event changed' using errcode='40001'; end if;
   return to_jsonb(r);
  end if;
 end if;
 if operation='SCHEDULE_RUN' then
  select * into cfg from portal_private.kr_schedule where id;
  if not cfg.enabled or day<>current_day or timezone('Asia/Riyadh',now())::time<cfg.approval_time then return jsonb_build_object('skipped',true); end if;
  if r.id is not null and r.status<>'DRAFT' then return to_jsonb(r); end if;
  if r.id is null then
   insert into portal_private.kr_daily_reports(report_date,content,facts,prepared_name,status,submitted_at)
   values(day,payload->'content',payload->'facts',actor_name,'PENDING_APPROVAL',now()) returning * into r;
  else
   update portal_private.kr_daily_reports set status='PENDING_APPROVAL',submitted_at=now(),revision=revision+1,updated_at=now() where id=r.id returning * into r;
  end if;
 elsif operation in ('PREPARE','IMPORT') and r.id is null then
  insert into portal_private.kr_daily_reports(report_date,content,facts,prepared_by,prepared_name)
  values(day,payload->'content',payload->'facts',actor,actor_name) returning * into r;
 else
  if r.id is null then raise exception 'Report not found' using errcode='P0002'; end if;
  if operation='APPROVE' and r.status='APPROVED' and r.approved_by=actor then return to_jsonb(r); end if;
  if (payload->>'revision')::integer is distinct from r.revision then raise exception 'Report changed; reload' using errcode='40001'; end if;
  if operation='REOPEN' then
   if r.status not in ('PENDING_APPROVAL','APPROVED') or nullif(btrim(payload->>'note'),'') is null then
    raise exception 'Locked report and reopening reason required' using errcode='40001';
   end if;
   perform 1 from public.kr_agenda_tasks where report_id=r.id for update;
   insert into portal_private.kr_report_revisions(report_id,revision,report_status,report_snapshot,agenda_snapshot,actor_id,actor_name,reason)
   values(r.id,r.revision,r.status,to_jsonb(r),coalesce((select jsonb_agg(to_jsonb(t) order by t.due_at,t.id) from public.kr_agenda_tasks t where report_id=r.id),'[]'),actor,actor_name,left(btrim(payload->>'note'),2000));
   update portal_private.kr_daily_reports set status='RETURNED',submitted_at=null,approved_by=null,approved_name=null,approved_at=null,
    return_note=left(btrim(payload->>'note'),2000),revision=revision+1,updated_at=now() where id=r.id returning * into r;
  elsif operation in ('SAVE','PREPARE','IMPORT') then
   if r.status not in ('DRAFT','RETURNED') then raise exception 'Report is locked' using errcode='40001'; end if;
   update portal_private.kr_daily_reports set content=payload->'content',facts=case when operation in ('PREPARE','IMPORT') then payload->'facts' else facts end,
    prepared_by=actor,prepared_name=actor_name,revision=revision+1,updated_at=now() where id=r.id returning * into r;
  elsif operation='SUBMIT' then
   if r.status not in ('DRAFT','RETURNED') then raise exception 'Cannot submit' using errcode='40001'; end if;
   update portal_private.kr_daily_reports set status='PENDING_APPROVAL',submitted_at=now(),return_note=null,revision=revision+1,updated_at=now() where id=r.id returning * into r;
  elsif operation='RETURN' then
   if account.role<>'CEO' then raise exception 'CEO required' using errcode='42501'; end if;
   if r.status<>'PENDING_APPROVAL' or nullif(btrim(payload->>'note'),'') is null then raise exception 'Pending report and return note required'; end if;
   update portal_private.kr_daily_reports set status='RETURNED',return_note=left(payload->>'note',2000),revision=revision+1,updated_at=now() where id=r.id returning * into r;
  elsif operation='APPROVE' then
   if account.role<>'CEO' then raise exception 'CEO required' using errcode='42501'; end if;
   if r.status<>'PENDING_APPROVAL' then raise exception 'Pending report required' using errcode='40001'; end if;
   perform 1 from public.kr_agenda_tasks where report_id=r.id for update;
   update public.kr_agenda_tasks t set is_current=false where t.report_id=r.id and not exists
    (select 1 from jsonb_array_elements(r.content->'tomorrow') a where (a->>'id')::uuid=t.action_id);
   for item in select value from jsonb_array_elements(r.content->'tomorrow') loop
    if timezone('Asia/Riyadh',(item->>'due_at')::timestamptz)::date<>day+1 then raise exception 'Next-day date required'; end if;
    select count(*),(array_agg(user_id))[1] into matches,assignee from portal_private.accounts where is_active and role in ('ADMIN','CEO','EMPLOYEE') and full_name=item->>'owner';
    if matches<>1 then assignee:=null; end if;
    insert into public.kr_agenda_tasks as prior_task(report_id,action_id,action,contact,owner,assigned_user_id,due_at,indicator)
    values(r.id,(item->>'id')::uuid,item->>'action',item->>'contact',item->>'owner',assignee,(item->>'due_at')::timestamptz,item->>'indicator')
    on conflict(report_id,action_id) do update set
     action=excluded.action,contact=excluded.contact,owner=excluded.owner,assigned_user_id=excluded.assigned_user_id,due_at=excluded.due_at,indicator=excluded.indicator,is_current=true,
     status=case when prior_task.is_current and
      row(prior_task.action,prior_task.contact,prior_task.owner,prior_task.assigned_user_id,prior_task.due_at,prior_task.indicator)
      is not distinct from row(excluded.action,excluded.contact,excluded.owner,excluded.assigned_user_id,excluded.due_at,excluded.indicator)
      then prior_task.status else 'PENDING' end;
   end loop;
   update portal_private.kr_daily_reports set status='APPROVED',approved_by=actor,approved_name=actor_name,approved_at=now(),revision=revision+1,updated_at=now() where id=r.id returning * into r;
  else raise exception 'Unknown operation'; end if;
 end if;
 if operation='IMPORT' then insert into portal_private.kr_imports(event_id,report_id,digest) values(event,r.id,payload->>'digest'); end if;
 insert into portal_private.kr_report_events(report_id,actor_id,actor_name,action,revision) values(r.id,actor,actor_name,operation,r.revision);
 return to_jsonb(r);
end $$;
revoke all on function public.kr_workflow(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.kr_workflow(uuid,text,jsonb) to service_role;

commit;
