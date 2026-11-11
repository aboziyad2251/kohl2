-- Additive candidate only. Apply this migration alone after release approval.
begin;
create table portal_private.leasing_units(
 id uuid primary key, property_id uuid not null references public.properties(id),code text not null check(length(code) between 1 and 160),
 readiness text not null check(readiness in ('READY','CLEANING','MAINTENANCE','UNAVAILABLE')),note text not null check(length(note) between 1 and 1000),
 unique(property_id,code));
create table portal_private.leasing_cases(
 id uuid primary key,lead_id uuid not null references public.crm_leads(id),assignee_id uuid not null references portal_private.accounts(user_id),
 kind text not null check(kind in ('DAILY','MONTHLY','ANNUAL')),source text not null check(length(source) between 1 and 160),need text not null check(length(need) between 1 and 1000),
 stage text not null default 'NEW' check(stage in ('NEW','QUALIFIED','OFFERED','VIEWING','CONFIRMED','LOST','CANCELLED')),
 qualified_at timestamptz,unit_id uuid references portal_private.leasing_units(id),start_date date,end_date date,amount numeric(14,2) check(amount>0 and amount<=999999999),
 beneficiary text check(beneficiary in ('COMPANY','OWNER')),contract_id uuid references public.contracts(id),version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_date is null or start_date is null or end_date>start_date),
 check(stage<>'CONFIRMED' or (unit_id is not null and start_date is not null and end_date is not null and amount is not null and beneficiary is not null)));
create unique index leasing_contract_once on portal_private.leasing_cases(contract_id) where contract_id is not null;
create index leasing_assignee on portal_private.leasing_cases(assignee_id,created_at desc);
create index leasing_unit_period on portal_private.leasing_cases(unit_id,start_date,end_date) where stage='CONFIRMED';
create table portal_private.leasing_followups(
 id uuid primary key,case_id uuid not null references portal_private.leasing_cases(id),assignee_id uuid not null references portal_private.accounts(user_id),
 title text not null check(length(title) between 1 and 160),due_at timestamptz not null,completed_at timestamptz,note text not null default '' check(length(note)<=1000),
 blocked_by text not null default 'NONE' check(blocked_by in ('NONE','MANAGEMENT','READINESS','CUSTOMER')));
create index leasing_followup_due on portal_private.leasing_followups(assignee_id,due_at);
create table portal_private.internal_dues(case_id uuid primary key references portal_private.leasing_cases(id),amount numeric(14,2) not null check(amount>0),due_date date not null,voided boolean not null default false);
create table portal_private.internal_installments(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references portal_private.internal_dues(case_id),
 sequence integer not null check(sequence between 1 and 120),amount numeric(14,2) not null check(amount>0),due_date date not null check(due_date between date '2000-01-01' and date '2099-12-31'),
 unique(case_id,sequence));
create index internal_installment_due on portal_private.internal_installments(due_date,case_id);
create table portal_private.internal_entries(
 id uuid primary key,case_id uuid references portal_private.leasing_cases(id),installment_id uuid references portal_private.internal_installments(id),kind text not null check(kind in ('RECEIPT','EXPENSE','DEPOSIT_IN','DEPOSIT_OUT','OWNER_PAYMENT','REFUND')),
 amount numeric(14,2) not null check(amount>0 and amount<=999999999),date date not null,holder text not null check(holder in ('COMPANY','OWNER','PLATFORM')),
 reference text not null check(length(reference) between 1 and 160),category text not null check(length(category) between 1 and 160),note text not null default '' check(length(note)<=1000),
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED')),created_by uuid not null references portal_private.accounts(user_id),created_at timestamptz not null default now(),
 decided_by uuid references portal_private.accounts(user_id),decided_at timestamptz,decision_note text not null default '',
 check(kind='EXPENSE' or case_id is not null));
create table portal_private.operations_documents(
 id uuid primary key,entry_id uuid not null references portal_private.internal_entries(id),uploaded_by uuid not null references portal_private.accounts(user_id),
 filename text not null check(length(filename) between 1 and 150),mime text not null check(mime in ('application/pdf','image/png','image/jpeg','image/webp')),
 size integer not null check(size between 1 and 5242880),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 object_path text not null unique,status text not null check(status in ('UPLOADING','READY')),created_at timestamptz not null default now());
create index operations_documents_entry on portal_private.operations_documents(entry_id,status);
create unique index internal_entry_reference on portal_private.internal_entries(kind,holder,reference) where status<>'REJECTED';
create index internal_entry_case on portal_private.internal_entries(case_id,status);
create index internal_entry_date on portal_private.internal_entries(date,status);
create table portal_private.operations_history(id uuid primary key default gen_random_uuid(),entity_id uuid not null,case_id uuid references portal_private.leasing_cases(id),actor uuid not null references portal_private.accounts(user_id),action text not null,note text not null,changes jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create index operations_history_case on portal_private.operations_history(case_id,created_at desc);
create table portal_private.operations_replays(id uuid primary key,actor uuid not null,operation text not null,payload jsonb not null,result jsonb not null);
create table portal_private.operations_exports(id uuid primary key,actor uuid not null references portal_private.accounts(user_id),period_from date not null,period_to date not null,snapshot jsonb not null,created_at timestamptz not null default now());
-- Private tables have no direct browser grants; narrow RPCs check the caller's active private account.
do $$ declare t text; begin foreach t in array array['leasing_units','leasing_cases','leasing_followups','internal_dues','internal_installments','operations_documents','internal_entries','operations_history','operations_replays','operations_exports'] loop
 execute format('alter table portal_private.%I enable row level security',t);
 execute format('revoke all on portal_private.%I from public,anon,authenticated',t);
end loop; end $$;

create function public.kohl_operations(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare who uuid:=auth.uid(); acct portal_private.accounts; executive boolean; cid uuid; target uuid; assigned uuid;
 installment uuid; installment_total numeric; part jsonb; part_number integer;
 c portal_private.leasing_cases; u portal_private.leasing_units; f portal_private.leasing_followups; e portal_private.internal_entries;
 prior portal_private.operations_replays; result jsonb; allowed text[]; memo text; desired text; amount_value numeric; collected numeric; returned numeric; balance numeric; holder_value text; snapshot jsonb; from_day date; to_day date;
begin
 select * into acct from portal_private.accounts where user_id=who and is_active for share;
 if not found or acct.role not in ('ADMIN','CEO','EMPLOYEE') then raise insufficient_privilege; end if;
 executive:=acct.role in ('ADMIN','CEO');
 if payload is null or jsonb_typeof(payload)<>'object' then raise invalid_parameter_value; end if;
 if operation='EXPORT_READ' then
  if not executive then raise insufficient_privilege; end if;
  if payload-array['id']<>'{}'::jsonb or payload->>'id' is null then raise invalid_parameter_value; end if;
  select x.snapshot into result from portal_private.operations_exports x where x.id=(payload->>'id')::uuid;
  if not found then raise insufficient_privilege; end if;
  return result;
 end if;
 if operation in ('LIST','EXPORT') then
  if operation='LIST' and payload<>'{}'::jsonb then raise invalid_parameter_value; end if;
  if operation='EXPORT' then
   if not executive then raise insufficient_privilege; end if;
   if payload-array['id','from','to']<>'{}'::jsonb then raise invalid_parameter_value; end if;
   target:=(payload->>'id')::uuid;from_day:=(payload->>'from')::date;to_day:=(payload->>'to')::date;
   if target is null or from_day is null or to_day is null or to_day<from_day or to_day-from_day>366 then raise invalid_parameter_value; end if;
   perform pg_advisory_xact_lock(hashtextextended(target::text,0));
   select * into prior from portal_private.operations_replays where id=target;
   if found then
    if prior.actor<>who or prior.operation<>operation or prior.payload<>payload then raise exception 'Replay conflict' using errcode='40001'; end if;
    return prior.result;
   end if;
  end if;
  -- Explicit bounds: never silently truncate dashboards or accountant exports.
  if (select count(*) from portal_private.leasing_cases where executive or assignee_id=who)>5000
   or (select count(*) from portal_private.internal_entries e where executive or e.created_by=who)>10000
   or (select count(*) from portal_private.leasing_followups where executive or assignee_id=who)>10000
   or (select count(*) from portal_private.operations_history)>20000
   or (select count(*) from public.crm_leads where executive or assigned_agent_id=acct.employee_id)>5000 then
   raise exception 'Workspace requires archive/pagination' using errcode='54000';
  end if;
  select jsonb_build_object('role',acct.role,'captured_at',now(),
   'exports',case when executive then coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select id,period_from,period_to,created_at from portal_private.operations_exports order by created_at desc limit 50) x),'[]'::jsonb) else '[]'::jsonb end,
   'cases',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from (
    select c.*,l.name customer_name,l.phone,a.full_name assignee_name from portal_private.leasing_cases c join public.crm_leads l on l.id=c.lead_id join portal_private.accounts a on a.user_id=c.assignee_id where executive or c.assignee_id=who) x),'[]'::jsonb),
   'followups',coalesce((select jsonb_agg(to_jsonb(f) order by due_at,id) from portal_private.leasing_followups f where executive or f.assignee_id=who),'[]'::jsonb),
   'entries',coalesce((select jsonb_agg(to_jsonb(e) order by date desc,id) from portal_private.internal_entries e where executive or e.created_by=who),'[]'::jsonb),
   'units',coalesce((select jsonb_agg(to_jsonb(x) order by x.property_name,x.code) from (select u.*,p.property_name from portal_private.leasing_units u join public.properties p on p.id=u.property_id) x),'[]'::jsonb),
   'dues',coalesce((select jsonb_agg(to_jsonb(x) order by x.due_date,x.sequence) from (select i.id,i.case_id,i.sequence,i.amount,i.due_date,d.voided from portal_private.internal_installments i join portal_private.internal_dues d on d.case_id=i.case_id join portal_private.leasing_cases c on c.id=i.case_id where executive or c.assignee_id=who) x),'[]'::jsonb),
   'documents',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from (select d.id,d.entry_id,d.filename,d.mime,d.size,d.sha256,d.created_at from portal_private.operations_documents d join portal_private.internal_entries e on e.id=d.entry_id where d.status='READY' and (executive or e.created_by=who)) x),'[]'::jsonb),
   'leads',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone,'source',source) order by name) from public.crm_leads where executive or assigned_agent_id=acct.employee_id),'[]'::jsonb),
   'properties',coalesce((select jsonb_agg(jsonb_build_object('id',id,'property_name',property_name) order by property_name) from public.properties),'[]'::jsonb),
   'staff',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'name',full_name)) from portal_private.accounts where is_active and role in ('ADMIN','CEO','EMPLOYEE') and (executive or user_id=who)),'[]'::jsonb),
   'contracts',case when executive then coalesce((select jsonb_agg(jsonb_build_object('id',id,'contract_number',contract_number)) from public.contracts),'[]'::jsonb) else '[]'::jsonb end,
   'history',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select h.entity_id,h.action,h.note,h.created_at,a.full_name actor_name from portal_private.operations_history h join portal_private.accounts a on a.user_id=h.actor where executive or (h.action not in ('ENTRY_CREATE','ENTRY_DECIDE') and exists(select 1 from portal_private.leasing_cases c where c.id=h.case_id and c.assignee_id=who)) or h.actor=who order by h.created_at desc,h.id) x),'[]'::jsonb)) into snapshot;
  if operation='LIST' then return snapshot; end if;
  result:=jsonb_build_object('id',target,'from',from_day,'to',to_day,'created_at',now(),'workspace',snapshot);
  insert into portal_private.operations_exports values(target,who,from_day,to_day,result,now());
  insert into portal_private.operations_replays values(target,who,operation,payload,result);
  return result;
 end if;
 allowed:=case operation
 when 'CASE_CREATE' then array['id','lead_id','assignee_id','kind','source','need','next_action','due_at']
 when 'CASE_UPDATE' then array['id','version','stage','note','unit_id','start_date','end_date','amount','beneficiary','contract_id']
 when 'FOLLOWUP_ADD' then array['id','case_id','title','due_at']
 when 'FOLLOWUP_DONE' then array['id','note','blocked_by']
 when 'UNIT_SAVE' then array['id','property_id','code','readiness','note']
 when 'INSTALLMENTS_SAVE' then array['id','case_id','version','parts','note']
 when 'ENTRY_CREATE' then array['id','case_id','installment_id','kind','amount','date','holder','reference','category','note']
 when 'ENTRY_DECIDE' then array['id','status','note'] else null end;
 if allowed is null or payload-allowed<>'{}'::jsonb then raise invalid_parameter_value; end if;
 target:=(payload->>'id')::uuid;memo:=btrim(coalesce(payload->>'note',''));
 if target is null or length(memo)>1000 then raise invalid_parameter_value; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,0));
 if operation in ('CASE_CREATE','FOLLOWUP_ADD','ENTRY_CREATE','INSTALLMENTS_SAVE') then
  select * into prior from portal_private.operations_replays where id=target;
  if found then
   if prior.actor<>who or prior.operation<>operation or prior.payload<>payload then raise exception 'Replay conflict' using errcode='40001'; end if;
   return prior.result;
  end if;
 end if;
 if operation='CASE_CREATE' then
  assigned:=coalesce((payload->>'assignee_id')::uuid,who);
  if not executive and assigned<>who then raise insufficient_privilege; end if;
  if not exists(select 1 from portal_private.accounts where user_id=assigned and is_active and role in ('ADMIN','CEO','EMPLOYEE')) then raise insufficient_privilege; end if;
  if not exists(select 1 from public.crm_leads where id=(payload->>'lead_id')::uuid and (executive or assigned_agent_id=acct.employee_id)) then raise insufficient_privilege; end if;
  insert into portal_private.leasing_cases(id,lead_id,assignee_id,kind,source,need) values(target,(payload->>'lead_id')::uuid,assigned,payload->>'kind',btrim(payload->>'source'),btrim(payload->>'need'));
  insert into portal_private.leasing_followups(id,case_id,assignee_id,title,due_at) values(gen_random_uuid(),target,assigned,btrim(payload->>'next_action'),(payload->>'due_at')::timestamptz);
  cid:=target;
 elsif operation='INSTALLMENTS_SAVE' then
  if not executive then raise insufficient_privilege; end if;
  cid:=(payload->>'case_id')::uuid;
  select * into c from portal_private.leasing_cases where id=cid for update;
  if not found or c.stage<>'CONFIRMED' or c.version is distinct from (payload->>'version')::integer then raise exception 'Stale case' using errcode='40001'; end if;
  if exists(select 1 from portal_private.internal_entries where case_id=cid and kind in ('RECEIPT','REFUND')) then raise exception 'Schedule already has entries' using errcode='40001'; end if;
  if memo='' or jsonb_typeof(payload->'parts') is distinct from 'array' or jsonb_array_length(payload->'parts') not between 1 and 120 then raise invalid_parameter_value; end if;
  installment_total:=0;
  for part in select value from jsonb_array_elements(payload->'parts') loop
   if jsonb_typeof(part)<>'object' or part-array['amount','due_date']<>'{}'::jsonb or jsonb_typeof(part->'amount') is distinct from 'number'
    or jsonb_typeof(part->'due_date') is distinct from 'string' or (part->>'due_date') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or (part->>'amount')::numeric<=0 or (part->>'amount')::numeric<>round((part->>'amount')::numeric,2)
    or (part->>'due_date')::date not between date '2000-01-01' and date '2099-12-31' then raise invalid_parameter_value; end if;
   installment_total:=installment_total+(part->>'amount')::numeric;
  end loop;
  if installment_total<>c.amount then raise exception 'Installments must match contract total' using errcode='22023'; end if;
  delete from portal_private.internal_installments where case_id=cid;
  part_number:=0;
  for part in select value from jsonb_array_elements(payload->'parts') order by value->>'due_date' loop
   part_number:=part_number+1;
   insert into portal_private.internal_installments(case_id,sequence,amount,due_date) values(cid,part_number,(part->>'amount')::numeric,(part->>'due_date')::date);
  end loop;
  update portal_private.leasing_cases set version=version+1,updated_at=now() where id=cid;
 elsif operation='UNIT_SAVE' then
  if not executive then raise insufficient_privilege; end if;
  select * into u from portal_private.leasing_units where id=target for update;
  if found and (u.property_id<>(payload->>'property_id')::uuid or u.code<>btrim(payload->>'code')) then raise exception 'Unit identity immutable' using errcode='40001'; end if;
  insert into portal_private.leasing_units values(target,(payload->>'property_id')::uuid,btrim(payload->>'code'),payload->>'readiness',memo)
   on conflict(id) do update set readiness=excluded.readiness,note=excluded.note;
 elsif operation in ('CASE_UPDATE','FOLLOWUP_ADD','FOLLOWUP_DONE') then
  cid:=case when operation='CASE_UPDATE' then target when operation='FOLLOWUP_ADD' then (payload->>'case_id')::uuid else (select case_id from portal_private.leasing_followups where id=target) end;
  select * into c from portal_private.leasing_cases where id=cid for update;
  if not found or (not executive and c.assignee_id<>who) then raise insufficient_privilege; end if;
  if operation='FOLLOWUP_ADD' then
   if c.stage in ('LOST','CANCELLED') then raise invalid_parameter_value; end if;
   insert into portal_private.leasing_followups(id,case_id,assignee_id,title,due_at) values(target,cid,c.assignee_id,btrim(payload->>'title'),(payload->>'due_at')::timestamptz);
  elsif operation='FOLLOWUP_DONE' then
   select * into f from portal_private.leasing_followups where id=target for update;
   if f.completed_at is not null then raise exception 'Already completed' using errcode='40001'; end if;
   if memo='' then raise invalid_parameter_value; end if;
   update portal_private.leasing_followups set completed_at=now(),note=memo,blocked_by=payload->>'blocked_by' where id=target;
  else
   if c.version is distinct from (payload->>'version')::integer then raise exception 'Stale case' using errcode='40001'; end if;
   desired:=payload->>'stage';
   if (payload->>'amount')::numeric<>round((payload->>'amount')::numeric,2) then raise invalid_parameter_value; end if;
   if desired is null or memo='' then raise invalid_parameter_value; end if;
   if c.stage in ('LOST','CANCELLED') or (c.stage='CONFIRMED' and desired<>'CANCELLED') then raise exception 'Final case immutable' using errcode='40001'; end if;
   if not executive and (desired in ('CONFIRMED','CANCELLED') or c.stage='CONFIRMED') then raise insufficient_privilege; end if;
   if desired='CONFIRMED' then
    select * into u from portal_private.leasing_units where id=(payload->>'unit_id')::uuid for update;
    if not found or u.readiness<>'READY' then raise exception 'Unit not ready' using errcode='40001'; end if;
    if exists(select 1 from portal_private.leasing_cases other where other.unit_id=u.id and other.id<>target and other.stage='CONFIRMED' and other.start_date<(payload->>'end_date')::date and other.end_date>(payload->>'start_date')::date) then raise exception 'Booking conflict' using errcode='40001'; end if;
   end if;
   if desired='CANCELLED' then
    payload:=payload || jsonb_build_object('unit_id',c.unit_id,'start_date',c.start_date,'end_date',c.end_date,'amount',c.amount,'beneficiary',c.beneficiary,'contract_id',c.contract_id);
    if exists(select 1 from portal_private.internal_entries where case_id=cid and status in ('PENDING','APPROVED')) then raise exception 'Resolve financial entries before cancellation' using errcode='40001'; end if;
    update portal_private.internal_dues set voided=true where case_id=cid;
   end if;
   update portal_private.leasing_cases set qualified_at=case when desired in ('QUALIFIED','OFFERED','VIEWING','CONFIRMED') then coalesce(qualified_at,now()) else qualified_at end,stage=desired,unit_id=(payload->>'unit_id')::uuid,start_date=(payload->>'start_date')::date,end_date=(payload->>'end_date')::date,amount=(payload->>'amount')::numeric,beneficiary=payload->>'beneficiary',contract_id=(payload->>'contract_id')::uuid,version=version+1,updated_at=now() where id=cid;
   if desired='CONFIRMED' then
    insert into portal_private.internal_dues values(cid,(payload->>'amount')::numeric,(payload->>'start_date')::date,false);
    insert into portal_private.internal_installments(case_id,sequence,amount,due_date) values(cid,1,(payload->>'amount')::numeric,(payload->>'start_date')::date);
   end if;
  end if;
 elsif operation='ENTRY_CREATE' then
  cid:=(payload->>'case_id')::uuid;
  if cid is not null then
   select * into c from portal_private.leasing_cases where id=cid for update;
   if not found or c.stage<>'CONFIRMED' or (not executive and c.assignee_id<>who) then raise insufficient_privilege; end if;
  elsif not executive then raise insufficient_privilege; end if;
  if not executive and payload->>'kind' not in ('RECEIPT','DEPOSIT_IN') then raise insufficient_privilege; end if;
  if (payload->>'date')::date>(now() at time zone 'Asia/Riyadh')::date then raise invalid_parameter_value; end if;
  if (payload->>'amount')::numeric<>round((payload->>'amount')::numeric,2) then raise invalid_parameter_value; end if;
  installment:=(payload->>'installment_id')::uuid;
  if payload->>'kind' in ('RECEIPT','REFUND') then
   if installment is null and (select count(*) from portal_private.internal_installments where case_id=cid)=1 then
    select id into installment from portal_private.internal_installments where case_id=cid;
   end if;
   if installment is null or not exists(select 1 from portal_private.internal_installments where id=installment and case_id=cid) then raise invalid_parameter_value; end if;
  elsif installment is not null then raise invalid_parameter_value; end if;
  insert into portal_private.internal_entries(id,case_id,installment_id,kind,amount,date,holder,reference,category,note,created_by) values(target,cid,installment,payload->>'kind',(payload->>'amount')::numeric,(payload->>'date')::date,payload->>'holder',btrim(payload->>'reference'),btrim(payload->>'category'),memo,who);
 elsif operation='ENTRY_DECIDE' then
  if not executive then raise insufficient_privilege; end if;
  select * into e from portal_private.internal_entries where id=target;
  if not found then raise insufficient_privilege; end if;
  cid:=e.case_id;
  -- Serializes all money decisions for a case, including partial receipts/refunds.
  if cid is not null then select * into c from portal_private.leasing_cases where id=cid for update; end if;
  select * into e from portal_private.internal_entries where id=target for update;
  desired:=payload->>'status';
  if desired is null or desired not in ('APPROVED','REJECTED') or memo='' then raise invalid_parameter_value; end if;
  if exists(select 1 from portal_private.operations_documents where entry_id=target and status='UPLOADING' and created_at>now()-interval '15 minutes') then raise exception 'Document upload in progress' using errcode='40001'; end if;
  if e.status<>'PENDING' then raise exception 'Decision immutable' using errcode='40001'; end if;
  if desired='APPROVED' and cid is not null then
   if c.stage<>'CONFIRMED' then raise exception 'Case is not confirmed' using errcode='40001'; end if;
   select coalesce(sum(case when kind='RECEIPT' then amount when kind='REFUND' then -amount else 0 end),0) into collected from portal_private.internal_entries where case_id=cid and status='APPROVED';
   if e.kind in ('RECEIPT','REFUND') then
    select coalesce(sum(case when kind='RECEIPT' then amount when kind='REFUND' then -amount else 0 end),0) into installment_total from portal_private.internal_entries where installment_id=e.installment_id and status='APPROVED';
    if e.kind='RECEIPT' and installment_total+e.amount>(select amount from portal_private.internal_installments where id=e.installment_id) then raise exception 'Installment overpayment' using errcode='40001'; end if;
    if e.kind='REFUND' and e.amount>coalesce((select sum(case when kind='RECEIPT' then amount when kind='REFUND' then -amount else 0 end) from portal_private.internal_entries where installment_id=e.installment_id and holder=e.holder and status='APPROVED'),0) then raise exception 'Installment refund exceeds receipt' using errcode='40001'; end if;
   end if;
   if e.kind='RECEIPT' and collected+e.amount>(select amount from portal_private.internal_dues where case_id=cid and not voided) then raise exception 'Overpayment' using errcode='40001'; end if;
   if e.kind='REFUND' and e.amount>coalesce((select sum(case when kind='RECEIPT' then amount when kind='REFUND' then -amount when kind='OWNER_PAYMENT' then -amount else 0 end) from portal_private.internal_entries where case_id=cid and status='APPROVED' and holder=e.holder),0) then raise exception 'Refund exceeds available receipts' using errcode='40001'; end if;
   if e.kind='DEPOSIT_OUT' and e.amount>coalesce((select sum(case when kind='DEPOSIT_IN' then amount when kind='DEPOSIT_OUT' then -amount else 0 end) from portal_private.internal_entries where case_id=cid and status='APPROVED' and holder=e.holder),0) then raise exception 'Deposit over-refund' using errcode='40001'; end if;
   if e.kind='OWNER_PAYMENT' then
    if c.beneficiary<>'OWNER' or e.holder<>'COMPANY' then raise invalid_parameter_value; end if;
    select coalesce(sum(case when kind='RECEIPT' then amount when kind in ('REFUND','OWNER_PAYMENT') then -amount else 0 end),0) into balance from portal_private.internal_entries where case_id=cid and status='APPROVED' and holder='COMPANY';
    if e.amount>balance then raise exception 'Owner payout exceeds available funds' using errcode='40001'; end if;
   end if;
  end if;
  update portal_private.internal_entries set status=desired,decision_note=memo,decided_by=who,decided_at=now() where id=target;
 end if;
 insert into portal_private.operations_history(entity_id,case_id,actor,action,note,changes) values(target,cid,who,operation,memo,
  case when operation='CASE_UPDATE' then jsonb_build_object('before',to_jsonb(c),'after',(select to_jsonb(x) from portal_private.leasing_cases x where id=cid))
       when operation='ENTRY_DECIDE' then jsonb_build_object('before',to_jsonb(e),'after',(select to_jsonb(x) from portal_private.internal_entries x where id=target))
       when operation='UNIT_SAVE' then jsonb_build_object('before',to_jsonb(u),'after',(select to_jsonb(x) from portal_private.leasing_units x where id=target))
       else jsonb_build_object('submitted',payload) end);
 result:=jsonb_build_object('id',target,'saved',true);
 if operation in ('CASE_CREATE','FOLLOWUP_ADD','ENTRY_CREATE','INSTALLMENTS_SAVE') then insert into portal_private.operations_replays values(target,who,operation,payload,result); end if;
 return result;
end $$;
revoke all on function public.kohl_operations(text,jsonb) from public,anon;
grant execute on function public.kohl_operations(text,jsonb) to authenticated;

-- Scheduled KR receives only aggregate facts; no customer or banking references.
create function public.operations_kr_summary(day date) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'cases', (select count(*) from portal_private.leasing_cases where (created_at at time zone 'Asia/Riyadh')::date=day),
 'followups_due',(select count(*) from portal_private.leasing_followups where (due_at at time zone 'Asia/Riyadh')::date=day),
 'followups_done',(select count(*) from portal_private.leasing_followups where (due_at at time zone 'Asia/Riyadh')::date=day and completed_at is not null and completed_at < (day+1)::timestamp at time zone 'Asia/Riyadh'),
 'received',coalesce((select sum(amount) from portal_private.internal_entries where date=day and kind='RECEIPT' and status='APPROVED'),0),
 'expenses',coalesce((select sum(amount) from portal_private.internal_entries where date=day and kind='EXPENSE' and status='APPROVED'),0),
 'deposits',coalesce((select sum(amount) from portal_private.internal_entries where date=day and kind='DEPOSIT_IN' and status='APPROVED'),0),
 'pending',(select count(*) from portal_private.internal_entries where date=day and status='PENDING'));
$$;
revoke all on function public.operations_kr_summary(date) from public,anon,authenticated;
grant execute on function public.operations_kr_summary(date) to service_role;
notify pgrst,'reload schema';
commit;
