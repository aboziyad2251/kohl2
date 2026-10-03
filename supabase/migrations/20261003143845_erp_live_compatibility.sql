-- Reviewed against the live schema. During cutover apply this BEFORE Phase A
-- so Phase A grants/policies cover the newly created tables. Never run legacy seeds.
begin;
alter table public.contracts
 add column if not exists total_collected_amount numeric(14,2) not null default 0,
 add column if not exists office_profit numeric(14,2),
 add column if not exists security_deposit_amount numeric(14,2),
 add column if not exists lessor_requirements text,
 add column if not exists primary_lessor_consent boolean;
update public.contracts set office_profit=office_commission where office_profit is null;
update public.contracts set security_deposit_amount=security_deposit where security_deposit_amount is null;

alter table public.financial_transactions
 add column if not exists property_id uuid references public.properties(id),
 add column if not exists contract_id uuid references public.contracts(id),
 add column if not exists brokerage_agreement_id uuid references public.brokerage_agreements(id);
create index if not exists financial_transactions_property_idx on public.financial_transactions(property_id);
create index if not exists financial_transactions_contract_idx on public.financial_transactions(contract_id);
create index if not exists financial_transactions_brokerage_idx on public.financial_transactions(brokerage_agreement_id);

alter table public.ownership_audit_logs
 add column if not exists previous_lessor_id uuid references public.lessors(id),
 add column if not exists new_lessor_id uuid references public.lessors(id),
 add column if not exists previous_representative_id uuid references public.representatives(id),
 add column if not exists new_representative_id uuid references public.representatives(id);

-- Legacy management records cannot be converted without reviewing fee semantics.
do $$ begin
 if exists(select 1 from public.managed_properties) then
  raise exception 'Legacy managed properties require an explicit data mapping before cutover';
 end if;
end $$;
create table if not exists public.managed_property_contracts (
 id uuid primary key default gen_random_uuid(), contract_number text not null unique,
 property_name text not null, lessor_name text not null, lessor_phone text not null,
 property_type text not null check(property_type in ('Residential','Commercial','Mixed')),
 total_units integer not null check(total_units>=0), occupied_units integer not null check(occupied_units>=0),
 vacant_units integer not null check(vacant_units>=0),
 fee_type text not null check(fee_type in ('PERCENTAGE','FIXED_ANNUAL')),
 fee_value numeric(14,2) not null check(fee_value>=0),
 annual_expected_revenue numeric(14,2) not null default 0,
 collected_revenue numeric(14,2) not null default 0,
 transferred_to_owner numeric(14,2) not null default 0,
 start_date date not null, end_date date not null,
 status text not null check(status in ('Active','Under_Renewal','Expired','Suspended')),
 notes text, created_at timestamptz not null default now(),
 check(end_date>=start_date), check(occupied_units+vacant_units=total_units),
 check(fee_type<>'PERCENTAGE' or fee_value<=100)
);
alter table public.managed_property_contracts enable row level security;
revoke all on public.managed_property_contracts from public,anon,authenticated;
alter table public.property_maintenance_tasks
 add column if not exists managed_property_id uuid references public.managed_property_contracts(id),
 add column if not exists contractor_phone text;
create index if not exists maintenance_managed_property_idx on public.property_maintenance_tasks(managed_property_id);
-- The existing form accepts free-text categories (including elevator maintenance).
alter table public.property_maintenance_tasks drop constraint if exists property_maintenance_tasks_task_type_check;
alter table public.property_maintenance_tasks add constraint property_maintenance_tasks_task_type_check check(length(trim(task_type))>0);

create table if not exists public.archived_documents (
 id text primary key, archive_code varchar(50) not null unique,
 title varchar(255) not null, category varchar(50) not null,
 reference_number varchar(100) not null, client_or_entity varchar(255) not null,
 date date not null default current_date, status varchar(50) not null default 'ACTIVE',
 file_name varchar(255), file_size bigint, file_data_url text, notes text,
 tags text[], source_module varchar(50), created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.archived_documents enable row level security;
revoke all on public.archived_documents from public,anon,authenticated;
notify pgrst, 'reload schema';
commit;
