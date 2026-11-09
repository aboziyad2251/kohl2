-- Review and test before production application. Additive changes only; no historical migrations.
begin;
alter table public.properties
 add column if not exists rooms_edited boolean not null default false,
 add column if not exists lounges_edited boolean not null default false,
 add column if not exists bathrooms_edited boolean not null default false,
 add column if not exists entrances_edited boolean not null default false,
 add column if not exists price_edited boolean not null default false,
 add column if not exists rooms integer check(rooms between 0 and 100),
 add column if not exists lounges integer check(lounges between 0 and 100),
 add column if not exists bathrooms integer check(bathrooms between 0 and 100),
 add column if not exists entrances integer check(entrances between 0 and 100),
 add column if not exists price numeric(14,2) check(price>=0),
 add column if not exists region text,
 add column if not exists district text,
 add column if not exists media_url text check(media_url is null or media_url ~ '^https://');
alter table public.properties drop constraint if exists properties_property_kind_check;
alter table public.properties add constraint properties_property_kind_check check(property_kind in ('LAND','APARTMENT','VILLA','FLOOR','BUILDING','SHOWROOM','SHOP','KIOSK','FOOD_TRUCK'));
alter table public.contracts add column if not exists ejar_contract_number text,
 add column if not exists ejar_sync_status text not null default 'UNLINKED' check(ejar_sync_status in ('UNLINKED','PENDING','LINKED'));
alter table public.brokerage_agreements add column if not exists ejar_contract_number text,
 add column if not exists ejar_sync_status text not null default 'UNLINKED' check(ejar_sync_status in ('UNLINKED','PENDING','LINKED'));
-- Verification fields can only be recorded by management or a server-side integration.
create function portal_private.kr_guard_ejar() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (tg_op='INSERT' and (new.ejar_contract_number is not null or new.ejar_sync_status<>'UNLINKED'))
 or (tg_op='UPDATE' and (new.ejar_contract_number is distinct from old.ejar_contract_number or new.ejar_sync_status is distinct from old.ejar_sync_status)) then
  if current_user not in ('postgres','service_role') and not portal_private.is_executive() then
   raise exception 'Only management or integration may verify Ejar records' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function portal_private.kr_guard_ejar() from public,anon,authenticated;
create trigger kr_contract_ejar before insert or update on public.contracts for each row execute function portal_private.kr_guard_ejar();
create trigger kr_brokerage_ejar before insert or update on public.brokerage_agreements for each row execute function portal_private.kr_guard_ejar();
-- Existing internal agreement numbers and Active flags do not establish Ejar verification.
alter table public.financial_transactions add column if not exists third_party_amount numeric(14,2) check(third_party_amount>=0);

alter table public.crm_leads add column if not exists kr_category text check(kr_category in ('إيجار سكني','مستثمر تجاري','مسوقون وتوظيف','داخلي','غير مصنف')),
 add column if not exists kr_temperature text check(kr_temperature in ('ساخن','دافئ','بارد','شريك','غير مصنف'));

-- Read trusted ingestion links, not the user-editable created_by_name label.
create index if not exists kr_hatif_activity on portal_private.hatif_events(activity_id);
create index if not exists kr_crm_activity_created on public.crm_activities(created_at);
create function public.kr_hatif_source(day date) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'activity_type',a.activity_type,'created_at',a.created_at,'lead_id',a.lead_id,'lead_or_client_name',a.lead_or_client_name,'phone',l.phone,'notes',a.notes) order by a.created_at,a.id),'[]'::jsonb)
 from portal_private.hatif_events h join public.crm_activities a on a.id=h.activity_id left join public.crm_leads l on l.id=a.lead_id
 where a.created_at >= (day::timestamp at time zone 'Asia/Riyadh') and a.created_at < ((day+1)::timestamp at time zone 'Asia/Riyadh');
$$;
revoke all on function public.kr_hatif_source(date) from public,anon,authenticated;
grant execute on function public.kr_hatif_source(date) to service_role;

create table portal_private.kr_daily_reports (
 id uuid primary key default gen_random_uuid(), report_date date not null unique,
 status text not null default 'DRAFT' check(status in ('DRAFT','PENDING_APPROVAL','RETURNED','APPROVED')),
 revision integer not null default 1,
 content jsonb not null check(jsonb_typeof(content)='object'), facts jsonb not null check(jsonb_typeof(facts)='object'),
 prepared_by uuid references auth.users(id), prepared_name text not null,
 submitted_at timestamptz, approved_by uuid references auth.users(id), approved_name text, approved_at timestamptz, return_note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((status='APPROVED')=(approved_at is not null))
);
create index kr_reports_pending on portal_private.kr_daily_reports(report_date desc) where status='PENDING_APPROVAL';
alter table portal_private.kr_daily_reports enable row level security;
create table portal_private.kr_report_events (
 id bigint generated always as identity primary key, report_id uuid not null references portal_private.kr_daily_reports(id),
 actor_id uuid references auth.users(id), actor_name text not null, action text not null, revision integer not null, created_at timestamptz not null default now()
);
create index kr_report_events_report on portal_private.kr_report_events(report_id,created_at);
alter table portal_private.kr_report_events enable row level security;
create table portal_private.kr_imports (
 event_id uuid primary key, report_id uuid not null references portal_private.kr_daily_reports(id), digest text not null, created_at timestamptz not null default now()
);
alter table portal_private.kr_imports enable row level security;
create table portal_private.kr_schedule (
 id boolean primary key default true check(id), enabled boolean not null default true,
 approval_time time not null default '22:00', timezone text not null default 'Asia/Riyadh' check(timezone='Asia/Riyadh'), updated_at timestamptz not null default now()
);
insert into portal_private.kr_schedule(id) values(true);
alter table portal_private.kr_schedule enable row level security;
revoke all on portal_private.kr_daily_reports,portal_private.kr_report_events,portal_private.kr_imports,portal_private.kr_schedule from public,anon,authenticated;
grant select,insert,update on portal_private.kr_daily_reports,portal_private.kr_schedule to service_role;
grant select,insert on portal_private.kr_report_events,portal_private.kr_imports to service_role;
grant usage,select on sequence portal_private.kr_report_events_id_seq to service_role;

create table public.kr_agenda_tasks (
 id uuid primary key default gen_random_uuid(), report_id uuid not null references portal_private.kr_daily_reports(id),
 action_id uuid not null, action text not null, contact text not null default '', owner text not null,
 assigned_user_id uuid references auth.users(id), due_at timestamptz not null,
 due_date date generated always as (timezone('Asia/Riyadh',due_at)::date) stored,
 indicator text not null, status text not null default 'PENDING' check(status in ('PENDING','COMPLETED')),
 created_at timestamptz not null default now(), unique(report_id,action_id)
);
create index kr_agenda_date on public.kr_agenda_tasks(due_date);
create index kr_agenda_assignee on public.kr_agenda_tasks(assigned_user_id,due_date);
alter table public.kr_agenda_tasks enable row level security;
revoke all on public.kr_agenda_tasks from public,anon,authenticated;
grant select,update(status) on public.kr_agenda_tasks to authenticated;
grant select,insert,update on public.kr_agenda_tasks to service_role;
create policy kr_agenda_read on public.kr_agenda_tasks for select to authenticated using(portal_private.is_executive() or assigned_user_id=(select auth.uid()));
create policy kr_agenda_complete on public.kr_agenda_tasks for update to authenticated using(portal_private.is_executive() or assigned_user_id=(select auth.uid())) with check(portal_private.is_executive() or assigned_user_id=(select auth.uid()));

-- Matches the existing service-only portal_workflow pattern. This function is NOT
-- executable by authenticated/anon. The Next API verifies the bearer identity first.
create function public.kr_workflow(actor uuid, operation text, payload jsonb default '{}') returns jsonb
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
 if operation='GET' then
  select * into r from portal_private.kr_daily_reports where report_date=day;
  if not found then return 'null'; end if;
  return to_jsonb(r)||jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from portal_private.kr_report_events e where report_id=r.id),'[]'));
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
  if operation in ('SAVE','PREPARE','IMPORT') then
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
   for item in select value from jsonb_array_elements(r.content->'tomorrow') loop
    if timezone('Asia/Riyadh',(item->>'due_at')::timestamptz)::date<>day+1 then raise exception 'Next-day date required'; end if;
    select count(*),(array_agg(user_id))[1] into matches,assignee from portal_private.accounts where is_active and role in ('ADMIN','CEO','EMPLOYEE') and full_name=item->>'owner';
    if matches<>1 then assignee:=null; end if;
    insert into public.kr_agenda_tasks(report_id,action_id,action,contact,owner,assigned_user_id,due_at,indicator)
    values(r.id,(item->>'id')::uuid,item->>'action',item->>'contact',item->>'owner',assignee,(item->>'due_at')::timestamptz,item->>'indicator') on conflict(report_id,action_id) do nothing;
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
-- Keep deed reuse, scope and import idempotency unchanged; add the FLOOR classification.
create or replace function public.import_property_apartments(payload jsonb, fingerprint text, object_path text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d uuid; row_data jsonb; ids uuid[]='{}'; p uuid; prior record; request_id uuid; owner_id uuid; skipped integer:=0; existing_count integer; kind text; use_type text;
begin
 if auth.uid() is null or not (portal_private.is_executive() or portal_private.has_role('EMPLOYEE')) then raise exception 'Not authorized' using errcode='42501'; end if;
 request_id:=(payload->>'request_id')::uuid;owner_id:=(payload->>'lessor_id')::uuid;
 if request_id is null or fingerprint is null or length(fingerprint)<>64 or fingerprint !~ '^[a-f0-9]+$' then raise exception 'Invalid import';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into prior from public.property_import_batches where id=request_id;
 if found then
  if prior.fingerprint is distinct from fingerprint then raise exception 'Import changed';end if;
  ids:=prior.property_ids;
  return jsonb_build_object('document_id',prior.document_id,'property_ids',coalesce(ids,'{}'),'replayed',true,'skipped',prior.skipped_count);
 end if;
 if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows') not between 1 and 500 then raise exception 'Invalid apartments';end if;
 if nullif(btrim(payload->>'building_name'),'') is null or nullif(btrim(payload->>'city'),'') is null or nullif(btrim(payload->>'address'),'') is null or nullif(btrim(payload->>'document_number'),'') is null or (payload->>'issue_date')::date is null then raise exception 'Missing information';end if;
 if (payload->>'latitude') is null or (payload->>'longitude') is null or not ((payload->>'latitude')::float8 between -90 and 90 and (payload->>'longitude')::float8 between -180 and 180) then raise exception 'Invalid GPS';end if;
 if object_path !~ ('^'||request_id::text||'/[a-f0-9]{64}\.(pdf|jpg|png)$') then raise exception 'Invalid deed path';end if;
 perform 1 from public.lessors where id=owner_id;if not found then raise exception 'Owner unavailable';end if;
 -- Serialize imports of the same deed to prevent accidental repeated schedules.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||translate(btrim(payload->>'document_number'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),0));
 select count(*), (array_agg(id order by id))[1] into existing_count,d from public.ownership_documents where lessor_id=owner_id and translate(btrim(document_number),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')=translate(btrim(payload->>'document_number'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');
 if existing_count>1 then raise exception 'Multiple deeds match; review records' using errcode='P0002'; end if;
 kind:=coalesce(payload->>'property_kind','APARTMENT');use_type:=coalesce(payload->>'property_use','Residential');
 if kind not in ('LAND','APARTMENT','VILLA','FLOOR','BUILDING','SHOWROOM','SHOP','KIOSK','FOOD_TRUCK') or use_type not in ('Residential','Commercial') then raise exception 'Invalid classification';end if;
 if d is null then
  d:=gen_random_uuid();
  insert into public.ownership_documents(id,document_number,issue_date,lessor_id,deed_object_path,import_request_id,import_fingerprint)
  values(d,btrim(payload->>'document_number'),(payload->>'issue_date')::date,owner_id,object_path,request_id,fingerprint);
 end if;
 for row_data in select value from jsonb_array_elements(payload->'rows') loop
  if nullif(btrim(row_data->>'apartment_number'),'') is null or length(row_data->>'apartment_number')>60 or jsonb_typeof(row_data) is distinct from 'object' then raise exception 'Invalid apartment';end if;
  if exists(select 1 from public.properties where ownership_document_id=d and translate(btrim(spreadsheet_details->>'apartment_number'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')=translate(btrim(row_data->>'apartment_number'),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789')) then skipped:=skipped+1;continue;end if;
  p:=gen_random_uuid();
  insert into public.properties(id,property_name,property_type,address,city,units_count,ownership_document_id,lessor_id,latitude,longitude,map_purposes,map_visible,spreadsheet_details,property_kind,property_use)
  values(p,(payload->>'building_name')||' — '||case kind when 'LAND' then 'أرض' when 'APARTMENT' then 'شقة' when 'VILLA' then 'فيلا' when 'FLOOR' then 'دور' when 'BUILDING' then 'عمارة' when 'SHOWROOM' then 'معرض' when 'SHOP' then 'محل' when 'KIOSK' then 'كشك' else 'فود ترك' end||' '||(row_data->>'apartment_number'),use_type,payload->>'address',payload->>'city',1,d,owner_id,(payload->>'latitude')::float8,(payload->>'longitude')::float8,array(select jsonb_array_elements_text(payload->'map_purposes')),true,row_data||jsonb_build_object('source_name',payload->>'source_name','sheet_name',payload->>'sheet_name'),kind,use_type);
  ids:=array_append(ids,p);
 end loop;
 insert into public.property_import_batches(id,fingerprint,document_id,property_ids,skipped_count,created_by) values(request_id,fingerprint,d,ids,skipped,auth.uid());
 return jsonb_build_object('document_id',d,'property_ids',ids,'replayed',false,'skipped',skipped);
end $$;
revoke all on function public.import_property_apartments(jsonb,text,text) from public,anon;
grant execute on function public.import_property_apartments(jsonb,text,text) to authenticated;
commit;
