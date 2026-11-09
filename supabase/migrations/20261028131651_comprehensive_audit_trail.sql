-- New activity only. Existing streams remain intact; no fabricated backfill.
begin;
set local lock_timeout='5s';
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid, user_name text, user_email text,
 action_type text not null check(action_type in ('LOGIN','LOGOUT','CREATE','UPDATE','DELETE','EXPORT','FORM_SUBMIT')),
 module text not null, record_id text, details jsonb not null default '{}',
 ip_address inet, user_agent text, request_id uuid, created_at timestamptz not null default clock_timestamp(),
 check(jsonb_typeof(details)='object' and octet_length(details::text)<=65536)
);
create index audit_logs_created_idx on public.audit_logs(created_at desc,id);
create index audit_logs_user_idx on public.audit_logs(user_id,created_at desc);
create index audit_logs_filter_idx on public.audit_logs(module,action_type,created_at desc);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from public,anon,authenticated,service_role;
alter table portal_private.accounts add column audit_viewer boolean not null default false;
create function portal_private.can_read_audit() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from portal_private.accounts a where a.user_id=auth.uid() and a.is_active and (a.role in ('ADMIN','CEO') or a.role in ('HR','EMPLOYEE') and a.audit_viewer));
$$;
revoke all on function portal_private.can_read_audit() from public,anon;
grant execute on function portal_private.can_read_audit() to authenticated;
grant select on public.audit_logs to authenticated,service_role;
create policy audit_management_read on public.audit_logs for select to authenticated using((select portal_private.can_read_audit()));

create function portal_private.audit_scrub(value jsonb, depth integer default 0) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb; begin
 if depth>8 then return '"[depth omitted]"'::jsonb; end if;
 if jsonb_typeof(value)='object' then
  select coalesce(jsonb_object_agg(key,case when key ~* '(password|secret|token|national.?id|iqama|iban|signature|object_path|storage_path|attachment_path|file_url|media_url)' then '"[redacted]"'::jsonb else portal_private.audit_scrub(v,depth+1) end),'{}') into result from jsonb_each(value) e(key,v);
 elsif jsonb_typeof(value)='array' then
  select coalesce(jsonb_agg(portal_private.audit_scrub(v,depth+1)),'[]') into result from (select v from jsonb_array_elements(value) e(v) limit 500) s;
 elsif jsonb_typeof(value)='string' and length(value#>>'{}')>2000 then result:=to_jsonb(left(value#>>'{}',2000)||' [truncated]');
 else result:=value; end if; return result;
end $$;
revoke all on function portal_private.audit_scrub(jsonb,integer) from public,anon,authenticated;

create function portal_private.audit_append(actor uuid,action text,area text,target text,metadata jsonb,ip text default null,agent text default null,correlation uuid default null,claimed_email text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; label text; email text; address inet; clean jsonb; begin
 select a.full_name into label from portal_private.accounts a where a.user_id=actor;
 select u.email into email from auth.users u where u.id=actor;
 begin address:=nullif(ip,'')::inet; exception when invalid_text_representation then address:=null; end;
 clean:=portal_private.audit_scrub(coalesce(metadata,'{}'));
 if octet_length(clean::text)>60000 then clean:=jsonb_build_object('source',clean->>'source','outcome',clean->>'outcome','omitted','Event exceeds detail size limit'); end if;
 insert into public.audit_logs(user_id,user_name,user_email,action_type,module,record_id,details,ip_address,user_agent,request_id)
 values(actor,label,coalesce(email,left(claimed_email,254)),action,left(area,100),left(target,300),clean,address,left(agent,1000),correlation) returning id into result;
 return result;
end $$;
revoke all on function portal_private.audit_append(uuid,text,text,text,jsonb,text,text,uuid,text) from public,anon,authenticated;

create function public.record_audit_event(actor uuid,action text,area text,target text default null,metadata jsonb default '{}',ip text default null,agent text default null,correlation uuid default null,claimed_email text default null) returns uuid
language plpgsql security invoker set search_path='' as $$ begin
 return portal_private.audit_append(actor,action,area,target,metadata,ip,agent,correlation,claimed_email);
end $$;
revoke all on function public.record_audit_event(uuid,text,text,text,jsonb,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.record_audit_event(uuid,text,text,text,jsonb,text,text,uuid,text),portal_private.audit_append(uuid,text,text,text,jsonb,text,text,uuid,text) to service_role;

create function portal_private.set_audit_access(actor uuid,target uuid,enabled boolean) returns boolean
language plpgsql security definer set search_path='' as $$ begin
 if not exists(select 1 from portal_private.accounts a where a.user_id=actor and a.is_active and a.role in ('ADMIN','CEO')) then raise exception 'Executive required' using errcode='42501'; end if;
 update portal_private.accounts a set audit_viewer=enabled where a.user_id=target and a.role in ('HR','EMPLOYEE') and (a.is_active or not enabled);
 return found;
end $$;
revoke all on function portal_private.set_audit_access(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function portal_private.set_audit_access(uuid,uuid,boolean) to service_role;

create function public.audit_access(actor uuid,operation text,payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare account portal_private.accounts; target uuid; enabled boolean; begin
 select * into account from portal_private.accounts a where a.user_id=actor and a.is_active;
 if operation='CHECK' then return to_jsonb(account.user_id is not null and (account.role in ('ADMIN','CEO') or account.role in ('HR','EMPLOYEE') and account.audit_viewer)); end if;
 if account.user_id is null or account.role not in ('ADMIN','CEO') then raise exception 'Executive required' using errcode='42501'; end if;
 if operation='LIST' then return coalesce((select jsonb_agg(jsonb_build_object('user_id',a.user_id,'name',a.full_name,'role',a.role,'active',a.is_active,'enabled',a.audit_viewer) order by a.full_name,a.user_id) from portal_private.accounts a where a.role in ('HR','EMPLOYEE')),'[]'); end if;
 if operation<>'SET' then raise exception 'Unknown operation'; end if;
 target:=(payload->>'user_id')::uuid;enabled:=(payload->>'enabled')::boolean;
 if enabled is null then raise exception 'Access flag required'; end if;
 if not portal_private.set_audit_access(actor,target,enabled) then raise exception 'Existing internal account required' using errcode='42501'; end if;
 perform portal_private.audit_append(actor,'UPDATE','Users',target::text,jsonb_build_object('source','audit_access','audit_viewer',enabled));
 return jsonb_build_object('user_id',target,'enabled',enabled);
end $$;
revoke all on function public.audit_access(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.audit_access(uuid,text,jsonb) to service_role;
-- Never grant direct UPDATE of accounts to the service role for this capability.
-- Use a narrow definer setter, with an explicit real actor check, in the private schema.

create function portal_private.audit_row_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_row jsonb:='{}'; after_row jsonb:='{}'; changes jsonb; actor uuid; headers jsonb; claims jsonb; correlation uuid; area text; begin
 if TG_OP<>'INSERT' then before_row:=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then after_row:=to_jsonb(new); end if;
 select coalesce(jsonb_object_agg(k,jsonb_build_object('before',before_row->k,'after',after_row->k)),'{}') into changes from (select jsonb_object_keys(before_row||after_row) k) s where before_row->k is distinct from after_row->k;
 if changes='{}' then return coalesce(new,old); end if;
 headers:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'); actor:=auth.uid();
 if claims->>'role'='service_role' and coalesce(headers->>'x-kohl-audit-actor','') ~ '^[0-9a-f-]{36}$' then actor:=(headers->>'x-kohl-audit-actor')::uuid; end if;
 if coalesce(headers->>'x-kohl-request-id','') ~ '^[0-9a-f-]{36}$' then correlation:=(headers->>'x-kohl-request-id')::uuid; end if;
 area:=case when TG_TABLE_NAME='bill_forms' then case when (before_row||after_row)#>>'{snapshot,form,kind}'='KC-M' then 'Broker Cooperation' else 'Bills & Forms' end when TG_TABLE_NAME in ('accounts','settings','owner_property_links','tenant_lease_links','broker_contract_links') then 'Users' when TG_TABLE_NAME='broker_office_agreements' then 'Broker Cooperation' when TG_TABLE_NAME in ('properties','ownership_documents','lessors','representatives','property_media','e_poas','managed_property_contracts','property_maintenance_tasks') then 'Properties' when TG_TABLE_NAME like 'kr_%' then 'Daily Reports' when TG_TABLE_NAME like 'crm_%' then 'CRM' when TG_TABLE_NAME like 'financial_%' then 'Financials' when TG_TABLE_NAME in ('contracts','brokerage_agreements') then 'Contracts' when TG_TABLE_NAME in ('employees','payroll_payments','leave_requests','timesheet_entries','task_delegations') then 'Employees' when TG_TABLE_SCHEMA='portal_private' then 'Portals' else initcap(replace(TG_TABLE_NAME,'_',' ')) end;
 perform portal_private.audit_append(actor,case TG_OP when 'INSERT' then 'CREATE' when 'UPDATE' then 'UPDATE' else 'DELETE' end,area,coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id'),jsonb_build_object('source','database','table',TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,'changes',changes,'outcome','SUCCESS'),case when claims->>'role'='service_role' then headers->>'x-kohl-trusted-ip' end,coalesce(headers->>'x-kohl-user-agent',headers->>'user-agent'),correlation);
 return coalesce(new,old);
end $$;
revoke all on function portal_private.audit_row_change() from public,anon,authenticated;
do $triggers$ declare r record; begin
 for r in select schemaname,tablename from pg_tables where (schemaname='public' and tablename<>'audit_logs') or (schemaname='portal_private' and tablename in ('accounts','settings','owner_property_links','tenant_lease_links','broker_office_agreements','broker_contract_links','payment_dues','maintenance_attachments','broker_kpis','documents','bill_forms','kr_daily_reports','kr_manager_access','kr_schedule')) loop
  execute format('create trigger kohl_audit_change after insert or update or delete on %I.%I for each row execute function portal_private.audit_row_change()',r.schemaname,r.tablename);
 end loop;
end $triggers$;

create function portal_private.audit_auth_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare info jsonb:=new.payload::jsonb; actor uuid; event text; begin
 event:=lower(coalesce(info->>'action',''));
 if event not in ('login','logout') then return new; end if;
 if coalesce(info->>'actor_id','') ~ '^[0-9a-f-]{36}$' then actor:=(info->>'actor_id')::uuid; end if;
 perform portal_private.audit_append(actor,upper(event),'Auth',null,jsonb_build_object('source','supabase_auth','outcome','SUCCESS','auth_event_id',new.id),new.ip_address,coalesce(info->>'user_agent',info#>>'{traits,user_agent}'),null,info->>'actor_username');
 return new;
end $$;
revoke all on function portal_private.audit_auth_event() from public,anon,authenticated;
create trigger kohl_audit_auth after insert on auth.audit_log_entries for each row execute function portal_private.audit_auth_event();
notify pgrst,'reload schema';
commit;
