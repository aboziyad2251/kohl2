# Kohl external portals — approval proposal

Status: review only. No application code or database has been changed. SQL below is proposed, not an applied migration. Repository inspected on 2026-10-03; live VPS schema and SMTP configuration have not been inspected.

## 1. Findings

- Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, react-hook-form and Zod. Supabase JS v2 is installed. Docker deploys the Next app separately from the static HTML site.
- `context/AuthContext.tsx` implements local user switching and browser password checks. It defaults to CEO, embeds initial passwords, and stores passwords/user state in localStorage. It does not establish Supabase Auth sessions. These credentials must be retired during the authenticated cutover.
- `lib/types.ts` has ADMIN, CEO, HR and EMPLOYEE. AppUser is a TypeScript/local seed model, not a persisted auth-linked role table. `employees.system_role` exists, but there is no auth.users foreign key in the inspected migration.
- `lib/supabaseClient.ts` creates a Supabase client with the public anon key. Self-hosted Supabase Docker definitions include Auth, PostgREST, Realtime, Storage and PostgreSQL; that does not confirm their live configuration.
- `lib/services/dbService.ts` fetches all entity tables with `select('*')` and merges browser fallback data. `app/layout.tsx` mounts that DataProvider for every page. External portals must never mount this provider or load those seeds/caches.
- `supabase/schema.sql` enables RLS but creates unrestricted ALL policies for anon/authenticated. The older initialization migration grants web_anon CRUD access on all tables. Both must be audited and replaced during cutover, including default privileges, views, functions, Storage and Realtime.
- Search API has an internal shared-token check; financial AI API currently has no user authentication check. Both need explicit internal authorization under the new model.

### Existing relevant relations (repository evidence)

| Area | Existing relation and fields | Gap / discrepancy |
|---|---|---|
| Staff | employees: id UUID, system_role, name, phone, email; timesheet_entries, payroll_payments, leave_requests, task_delegations | No verified authenticated identity mapping |
| Owners | lessors: id UUID, name, national_id_or_cr, phone, email | No portal login or ownership shares |
| Tenants | tenants: id UUID, name, national_id, phone, email | No portal login mapping |
| Properties | properties: id UUID, address, city, units_count, lessor_id, ownership_document_id | Init migration uses title; schema.sql uses property_name. No units table |
| Leases | contracts: id UUID, property_id, lessor_id, tenant_name, tenant_national_id, rent_amount, payment_schedule, start_date, end_date, status | schema.sql adds tenant_id; init migration does not. Status spelling/case differs. No unit FK or installment ledger |
| Brokerage | brokerage_agreements: id UUID, property_id, lessor_id, commission_rate, office_profit, start_date, expiry_date | Office commission is not a broker's agreement with the office; no broker identity/payout ledger |
| Management | managed_property_contracts: fee_type, fee_value, total_units, occupied_units, collected_revenue, transferred_to_owner, dates | This is what dbService queries. schema.sql instead defines managed_properties with different fields. No property FK in init definition |
| Maintenance | property_maintenance_tasks: id UUID, managed_property_id, unit_name, maintenance_type, cost_amount, status, notes | schema.sql instead uses property_id, unit_number, task_type, description. No requester, secure photos or full requested lifecycle |
| Finance | financial_transactions | Init/schema.sql use amount/category/reference fields; financial migration and TS services expect flow_type, transaction_type, gross_amount, tax_vat_amount, net_amount, property_id, contract_id, brokerage_agreement_id. CREATE TABLE IF NOT EXISTS does not reconcile these differences |
| Audit | ownership_audit_logs | Ownership changes only; no authenticated user administration audit |

No dedicated rent installment, receipt allocation, owner payout, broker payout or condition report tables were found. Aggregate collected/transferred fields cannot produce reliable dated owner statements.

## 2. Proposed data model

Use auth.users for identity and a private, database-authoritative account/role table. Preserve HR/EMPLOYEE roles but port their current permissions to database enforcement. Roles are never inferred from editable user_metadata. No public self-registration; only an authenticated active Admin/CEO may provision external accounts.

Phase A creates identity, settings, audit and assignment foundations. Phases B–D add operational ledgers after you test the previous phase. The following is the proposed Phase A DDL; the actual migration will be generated only after approval and a live catalog preflight.

```sql
begin;
create schema if not exists portal_private;
revoke all on schema portal_private from public, anon;
grant usage on schema portal_private to authenticated;

create table portal_private.accounts (
  user_id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  mobile text not null check (mobile ~ '^05[0-9]{8}$'),
  national_id_or_iqama text,
  role text not null check (role in ('ADMIN','CEO','HR','EMPLOYEE','BROKER','OWNER','TENANT')),
  is_active boolean not null default true,
  employee_id uuid unique references public.employees(id),
  lessor_id uuid references public.lessors(id),
  tenant_id uuid references public.tenants(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Email and last_sign_in_at remain authoritative in auth.users, accessed
-- only through the executive-only server endpoint. No password columns.

create table portal_private.settings (
  singleton boolean primary key default true check (singleton),
  tenant_lease_end_action text not null default 'HISTORY'
    check (tenant_lease_end_action in ('HISTORY','DEACTIVATE'))
);
insert into portal_private.settings(singleton) values(true);

create table portal_private.access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  target_user_id uuid references auth.users(id),
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  request_id uuid not null,
  created_at timestamptz not null default now()
);

create table portal_private.owner_property_links (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references portal_private.accounts(user_id),
  property_id uuid not null references public.properties(id),
  ownership_share numeric(7,4) not null check (ownership_share > 0 and ownership_share <= 100),
  effective_from date not null,
  effective_to date,
  check (effective_to is null or effective_to >= effective_from),
  unique(owner_user_id, property_id, effective_from)
);
create index on portal_private.owner_property_links(property_id);

create table portal_private.tenant_lease_links (
  tenant_user_id uuid not null references portal_private.accounts(user_id),
  contract_id uuid not null references public.contracts(id),
  created_at timestamptz not null default now(),
  primary key(tenant_user_id, contract_id)
);
create index on portal_private.tenant_lease_links(contract_id);

create table portal_private.broker_office_agreements (
  id uuid primary key default gen_random_uuid(),
  broker_user_id uuid not null references portal_private.accounts(user_id),
  agreement_number text unique not null,
  commission_type text not null check (commission_type in ('PERCENTAGE','FIXED')),
  commission_value numeric(14,2) not null check (commission_value >= 0),
  percentage_basis text check (percentage_basis in ('DEAL_VALUE','OFFICE_COMMISSION')),
  effective_from date not null,
  effective_to date,
  check (effective_to is null or effective_to >= effective_from),
  check ((commission_type = 'PERCENTAGE' and commission_value <= 100 and percentage_basis is not null)
    or (commission_type = 'FIXED' and percentage_basis is null)),
  unique(id, broker_user_id)
);
create table portal_private.broker_contract_links (
  broker_user_id uuid not null references portal_private.accounts(user_id),
  contract_id uuid not null references public.contracts(id),
  agreement_id uuid not null,
  primary key(broker_user_id, contract_id),
  foreign key(agreement_id, broker_user_id)
    references portal_private.broker_office_agreements(id, broker_user_id)
);
create index on portal_private.broker_contract_links(contract_id);

-- Role helpers read the caller's own database account. They are invokers,
-- preventing recursion because accounts_self_read does not invoke them.
alter table portal_private.accounts enable row level security;
grant select(user_id, full_name, mobile, role, is_active, employee_id, lessor_id, tenant_id)
  on portal_private.accounts to authenticated;
create policy accounts_self_read on portal_private.accounts
  for select to authenticated using(user_id = (select auth.uid()));

create function portal_private.is_executive() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from portal_private.accounts
    where user_id = auth.uid() and is_active and role in ('ADMIN','CEO'));
$$;
create function portal_private.has_role(expected_role text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from portal_private.accounts
    where user_id = auth.uid() and is_active and role = expected_role);
$$;
revoke all on function portal_private.is_executive() from public, anon;
revoke all on function portal_private.has_role(text) from public, anon;
grant execute on function portal_private.is_executive(), portal_private.has_role(text) to authenticated;

do $$ declare relation_name text; begin
  foreach relation_name in array array['settings','access_audit','owner_property_links',
    'tenant_lease_links','broker_office_agreements','broker_contract_links'] loop
    execute format('alter table portal_private.%I enable row level security',relation_name);
    execute format('revoke all on portal_private.%I from public, anon, authenticated',relation_name);
    execute format('grant select on portal_private.%I to authenticated',relation_name);
    execute format('create policy executive_read on portal_private.%I for select to authenticated using (portal_private.is_executive())',relation_name);
  end loop;
end $$;
create policy owner_links_self on portal_private.owner_property_links for select to authenticated
  using(owner_user_id = auth.uid() and portal_private.has_role('OWNER'));
create policy tenant_links_self on portal_private.tenant_lease_links for select to authenticated
  using(tenant_user_id = auth.uid() and portal_private.has_role('TENANT'));
create policy broker_links_self on portal_private.broker_contract_links for select to authenticated
  using(broker_user_id = auth.uid() and portal_private.has_role('BROKER'));
create policy broker_agreements_self on portal_private.broker_office_agreements for select to authenticated
  using(broker_user_id = auth.uid() and portal_private.has_role('BROKER'));
-- These private tables have no client write grants/policies. The trusted
-- server provisioning transaction validates the caller and emits audit rows.
-- Explicit service-role grants are included in the final migration after
-- verifying the server's actual database roles; it is never a browser key.
commit;
```

Additional Phase A database rules in the final migration:

1. Assignment triggers verify linked account role; reject mismatched BROKER/OWNER/TENANT identities even in privileged server writes.
2. Ownership changes lock the property row and reject overlapping effective-date intervals whose total shares exceed 100%. Preserve past assignments for historical accounting; removed links end future access according to the approved history policy.
3. Account/assignment/settings triggers write append-only audit rows using a validated actor and request ID supplied by a restricted administrative transaction. No passwords, invite tokens or complete national IDs in audit JSON. Record invite/reset/retry failures separately.
4. No automatic executive assignment. Bootstrap existing executives by verified email/auth UUID using a privileged one-time procedure; migrate employees by confirmed identities. Replace browser password auth before RLS cutover.
5. Catalog-driven replacement of permissive policies on ALL exposed tables, plus view/function grants and web_anon/default grants. Internal tables receive executive policies; existing HR/employee scopes must be preserved with employee_id predicates. Newly discovered relations default to no client grants until classified. Do not leave the old public policy beside restrictive policies.
6. Access checks require an active database account on each request, so deactivation is immediate even with an unexpired JWT. Expired lease setting is evaluated from database dates on reads/writes, not a background-job timing assumption. DEACTIVATE denies tenant data when there is no current valid lease; HISTORY permits only linked history and denies new requests. Revoked assignments remove access immediately.

### Later-phase exact proposed additions (separate approvals)

| Phase | Relation / changes | Proposed fields and constraints |
|---|---|---|
| B | property_units | id UUID PK; property_id FK properties; unit_number text; details jsonb containing approved public unit attributes only; unique(property_id,unit_number) |
| B | contracts | unit_id UUID FK property_units; tenant_id FK tenants only if absent; unit/property consistency trigger. Human-verified backfill, never infer a unit from units_count |
| B | lease_installments | id UUID; contract_id FK; due_date date; amount numeric(14,2) nonnegative; currency SAR; unique(contract_id,due_date,installment_number); paid status derived from posted receipt allocations |
| B | lease_receipt_allocations | installment_id FK; financial_transaction_id FK financial_transactions; amount numeric(14,2) positive; unique receipt allocation key; transaction-locked validation prevents over-allocation |
| B | maintenance_requests | id UUID; unit_id FK; contract_id FK; requester_user_id FK accounts; category; description; urgency LOW/NORMAL/HIGH/URGENT; status NEW/ASSIGNED/IN_PROGRESS/COMPLETED/CLOSED; submitted_at; completed_at. Internal contractor details kept separately |
| B | maintenance_request_events | id UUID; request_id FK; from_status; to_status; public_message; actor_user_id private; created_at. Tenant-facing projection omits staff identifiers |
| B | maintenance_request_tasks | request_id FK; existing property_maintenance_tasks.id FK; unique pair. Keeps current internal tasks intact while providing the richer external lifecycle |
| B | unit_condition_reports / portal_attachments | report id, unit_id, contract_id, report_date, public_condition; attachment id, request/report FK (exactly one), uploader UUID, private object path, mime_type, size. No public file URLs |
| C | managed_property_contracts | property_id FK properties only after live table confirmation and verified mapping; retain fee_type/fee_value and dates |
| C | owner_statement_entries | id UUID; owner_link_id FK; management_contract_id FK; source_transaction_id FK; kind RENT/MANAGEMENT_FEE/MAINTENANCE/ADJUSTMENT; effective_date; amount numeric(14,2); share and fee snapshots; unique source/allocation key |
| C | owner_payouts / owner_payout_allocations | payout id, owner_user_id, financial_transaction_id FK, paid_date, amount; allocations link payout to statement entries, validating currency, owner and amounts |
| D | broker_commission_entries | id UUID; broker/contract/agreement FK; recognition_date; commission_type/value/basis snapshots; eligible_base and earned_amount numeric(14,2); unique recognized deal event |
| D | broker_payouts / broker_payout_allocations | payout id, broker_user_id, financial_transaction_id FK, paid_date, amount; allocations to earned commission entries; no overpayment |

The later-phase tables are proposed definitions, not runnable migration SQL: financial columns and management relation depend on live inspection. Resolve the finance schema first; do not create a second independent financial truth. Statement entries and payouts must reconcile transaction-by-transaction to the existing canonical ledger with reversal entries and deterministic rounding, not mutable aggregate fields.

Default financial proposal: SAR rounded to halalas, Saudi business dates, collected cash rather than scheduled rent; split rent, office fees and owner-charged maintenance by effective ownership shares. Fixed annual management fees accrue daily across the contract term and are recorded as dated statement entries. Payouts reduce pending, not earnings. Broker percentage basis is explicitly selected on the agreement; fixed commission applies once per recognized deal. Confirm these business rules before C/D implementation.

## 3. RLS and exposure policy list

RLS restricts rows, not sensitive columns. Do not give external users SELECT on raw legacy contracts/finance/maintenance rows containing internal fields. Provide explicitly enumerated column projections through restricted, authenticated database functions in an exposed portal API schema. Each function validates auth.uid(), current account status and role, joins authoritative assignments and returns a fixed safe shape. A definer is justified only for these narrow projections; owner is a dedicated non-login role, search_path is fixed, EXECUTE is revoked from PUBLIC/anon, and every projection has cross-user API tests. Private helpers are not exposed through PostgREST. Ordinary internal queries use invoker/RLS.

| Data | Admin/CEO | Broker | Owner | Tenant |
|---|---|---|---|---|
| Accounts / identity | Manage via guarded server endpoint | Read own safe profile | Read own safe profile | Read own safe profile |
| Role/link/settings writes | Guarded transaction + audit | Deny | Deny | Deny |
| Staff, CRM, archive, internal notes, office finance/AI | Existing internal permissions | Deny | Deny | Deny |
| Properties and units | All | Only contract property summary | Assigned properties and their public unit details | Unit/property summary for linked lease |
| Contracts | All | Linked deal summary: property, counterparty name, value, dates, status | Assigned property lease summary; no tenant IDs/contact/private notes | Own linked lease and installments only |
| Broker agreements/commissions/payouts | All | Own only | Deny | Deny |
| Owner statements/payouts | All | Deny | Own share allocations only | Deny |
| Maintenance | Internal queue; permitted status updates | Deny | Owner-charge entries only | Linked lease/unit safe history; submit for current lease only |
| Condition reports | All | Deny | No access by default | Own lease reports only |
| Audit | Read; trigger/server append only | Deny | Deny | Deny |
| Storage | Guarded internal access | No uploads | Statement downloads only | Own authorized request photos/report photos |

Anon/web_anon: no business data access. Deactivated accounts: no portal data or mutation access. External roles have no DELETE and cannot UPDATE statuses, requester, financial fields, role or links. Maintenance submit function derives requester/contract/unit authorization itself and ignores client-supplied identity. Status transitions happen via executive-only transaction and immutable events. Lease history excludes other tenants' requests on the same unit, avoiding turnover disclosure.

Storage: private buckets, object paths scoped by authenticated user and authorized resource; DB/Storage policies check linkage for reads and tenant-owned valid request for inserts. Validate type/size; signed URLs issued only after access checks with short TTL. Revocation tests include URLs, RPCs and Realtime. Realtime must use authenticated sessions and protected tables/events, never an unfiltered public broadcast.

## 4. Screens and flows

- Shared: login; invite callback/set password; reset password; account/language controls; inactive/expired access page. Separate external route/layout without internal DataProvider/sidebar. Arabic RTL first, English LTR toggle, requested green palette, mobile layout, SAR and Gregorian dates; optional Hijri presentation.
- Phase A internal: Users & Access list (role/status/last login); Create User with role-specific assignment; user details/edit links; deactivate/reactivate; invite resend/reset; audit history; tenant expiry setting. Admin/CEO selection is not offered in external creation.
- Phase B tenant: home/unit and lease; installment schedule; condition report/photos; maintenance history; new request; request timeline. Internal: maintenance queue/detail/status transitions.
- Phase C owner: property list/detail, units/occupancy and safe lease summaries; earnings with daily/monthly/yearly/custom dates; payout history; authorized PDF statement.
- Phase D broker: own contracts/detail; commission agreement summary; earned/paid/pending cards; payout history.

Provisioning: validate current Supabase identity and active executive role server-side; validate Saudi mobile and links; provision identity without issuing an actionable invite until an inactive account and assignments are stored; activate the provisioned account and issue the email invite. Make retries idempotent and record failures. SMTP/redirect allowlist must be confirmed on self-hosted Auth. Copyable WhatsApp text is provided, but messages are not sent. Reset links use Auth; never generate or store plaintext passwords. Auth creation, DB transaction and email are separate systems: compensate partial failures and retain an auditable retry state.

## 5. Verification and delivery gates

Before migration: read live columns, constraints, foreign keys, roles, grants/default privileges, policies, views, functions, PostgREST exposed schemas, Auth/SMTP redirect configuration and publications. Back up database and confirm executive identity mappings. The conflicting repository SQL cannot be treated as the live schema.

Phase A tests: two accounts per external role and one Admin/CEO/HR/employee; direct REST/RPC requests with each user's real JWT; own allowed and other-user denied; anon denied; self-promotion/link mutation denied; inactive-token denial; invalid linked role rejected; overlapping ownership >100% rejected; secret/private columns absent; audit attributed and immutable; provisioning retry/SMTP failure coverage. Test all existing internal CRUD and integrations after strict RLS cutover. Test requests with unknown relation grants to detect old broad policies.

Phase B tests: only active linked lease can submit; spoofed unit/requester rejected; expired lease behavior enforced; another tenant's historical requests/photos denied; request visible internally immediately; updates visible to authorized tenant; upload access isolation.

Phase C tests: ledger reconciliation by period and share, partial payments, VAT convention, refunds/reversals, ownership transfers, fixed/percentage fee calculation, payout allocation and PDF authorization.

Phase D tests: two brokers sharing a property but different linked deals; fixed/percentage agreement snapshots, commission recognition and partial payouts; no office financial fields in responses.

Deliver Phase A for your test and stop; then B, then C, then D only after each phase is accepted. No VPS deployment or migration is included in this proposal stage.

## Approval requested

Approve the Phase A design and authenticated cutover, including removal of anonymous business access, retained HR/employee permissions and default HISTORY expiry behavior. After approval, first verify the live schema, finalize and show any schema-dependent SQL differences, then implement/test Phase A. Separate live migration/deployment authorization will be requested with concrete reviewed results if not already authorized.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth email invites](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail). The changelog markdown endpoint could not be read through the web tool; verify relevant self-hosted version behavior during implementation.
