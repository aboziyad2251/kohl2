-- Proposed only. Explicit approval required before production migration.
begin;
create function portal_private.hatif_normalize_phone(value text) returns text language sql immutable set search_path='' as $$
select case when x ~ '^[1-9][0-9]{7,14}$' then '+'||x else null end from (
 select case when n ~ '^05[0-9]{8}$' then '966'||substr(n,2) when n like '00%' then substr(n,3) else n end as x from (
 select regexp_replace(translate(coalesce(value,''),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[[:space:]()+.\-]','','g') as n) s) t;
$$;
revoke all on function portal_private.hatif_normalize_phone(text) from public,anon,authenticated;
grant execute on function portal_private.hatif_normalize_phone(text) to service_role;
create table portal_private.hatif_events(
 workspace_id uuid not null,channel_id uuid not null,kind text not null check(kind in ('CALL','WHATSAPP')),event_id text not null check(length(event_id) between 1 and 200),
 lead_id uuid references public.crm_leads(id) on delete set null,activity_id uuid references public.crm_activities(id) on delete set null,
 received_at timestamptz not null default now(),primary key(workspace_id,channel_id,kind,event_id));
alter table portal_private.hatif_events enable row level security;
revoke all on portal_private.hatif_events from public,anon,authenticated;
grant usage on schema portal_private to service_role;
grant select,insert on portal_private.hatif_events to service_role;
create function public.ingest_hatif_crm_event(event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare lead uuid;act uuid;prior record;matches integer;normalized_phone text;stamp timestamptz;lead_name text;
begin
 if event->>'workspace_id' is distinct from '3a22dc0c-549f-da45-fa62-9e69897bf05d' or event->>'channel_id' is distinct from '3a22dc0c-57bc-6e29-06b3-cd7aa539f176' then raise exception 'Scope not allowed' using errcode='42501';end if;
 if event->>'kind' is null or event->>'kind' not in ('CALL','WHATSAPP') or nullif(event->>'event_id','') is null or length(event->>'event_id')>200 then raise exception 'Invalid event';end if;
 perform pg_advisory_xact_lock(hashtextextended('hatif:event:'||(event->>'kind')||':'||(event->>'event_id'),0));
 select * into prior from portal_private.hatif_events where workspace_id=(event->>'workspace_id')::uuid and channel_id=(event->>'channel_id')::uuid and kind=event->>'kind' and event_id=event->>'event_id';
 if found then return jsonb_build_object('duplicate',true,'lead_id',prior.lead_id,'activity_id',prior.activity_id);end if;
 normalized_phone:=portal_private.hatif_normalize_phone(event->>'phone');if normalized_phone is null then raise exception 'Invalid phone';end if;
 stamp:=(event->>'occurred_at')::timestamptz;if stamp is null then raise exception 'Missing timestamp';end if;
 perform pg_advisory_xact_lock(hashtextextended('hatif:phone:'||normalized_phone,0));
 select count(*),(array_agg(id order by id))[1] into matches,lead from public.crm_leads where portal_private.hatif_normalize_phone(public.crm_leads.phone)=normalized_phone;
 if matches>1 then raise exception 'Multiple CRM leads match; review before linking' using errcode='P0002';end if;
 if lead is null then
  lead:=gen_random_uuid();lead_name:=coalesce(nullif(left(event->>'name',150),''),'عميل هاتف');
  insert into public.crm_leads(id,lead_code,name,phone,lead_type,stage,priority,source,preferred_city,notes)
  values(lead,'HT-'||left(replace(lead::text,'-',''),12),lead_name,normalized_phone,'UNSPECIFIED','NEW','MEDIUM',case when event->>'kind'='CALL' then 'PHONE' else 'WHATSAPP' end,null,'أُضيف تلقائياً من هاتف؛ نوع الطلب يحتاج تحديداً من الموظف.');
 else select name into lead_name from public.crm_leads where id=lead;end if;
 act:=gen_random_uuid();
 insert into public.crm_activities(id,lead_id,lead_or_client_name,activity_type,title,notes,due_date,status,created_by_name,created_at)
 values(act,lead,lead_name,event->>'kind',left(coalesce(event->>'title','هاتف'),150),left(event->>'notes',12000),timezone('Asia/Riyadh',stamp)::date,'COMPLETED','هاتف · ربط تلقائي',stamp);
 insert into portal_private.hatif_events(workspace_id,channel_id,kind,event_id,lead_id,activity_id) values((event->>'workspace_id')::uuid,(event->>'channel_id')::uuid,event->>'kind',event->>'event_id',lead,act);
 return jsonb_build_object('duplicate',false,'lead_id',lead,'activity_id',act);
end $$;
revoke all on function public.ingest_hatif_crm_event(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_hatif_crm_event(jsonb) to service_role;
commit;

