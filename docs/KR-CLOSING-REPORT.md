# KR closing report and property update

Updated 2026-10-27. Daily preparation is at22:00 Asia/Riyadh. Reports are visible
directly to authorized management; no report submission, approval or reopening step
is required. The historical-editing release e338f4b is live. The management-only
publication change and its new migration still require a separate production rollout.

## Dashboard accuracy

Documentation eligibility is explicitly defined as non-archived Active/Expired rental
contracts. Draft and Terminated contracts are excluded. The percentage is documented /
eligible, rounded to the nearest integer; an empty denominator displays0% and no eligible
contracts. A documented/linked record requires a nonempty valid Ejar number and explicit
LINKED synchronization state. Neither an internal agreement number nor an Active
contract/agreement status proves Ejar linkage. Existing rows start UNLINKED; no historical
verification is fabricated. Management or an existing authenticated server integration
must populate verification fields after checking evidence. A database trigger blocks
ordinary employees from setting or changing Ejar verification fields.

Dashboard metrics use a server endpoint with the caller's token/RLS, pagination and
explicit errors. Loading/unavailable values are not presented as zero.

Agency counts check both status and expiry against the Riyadh date. Zero active records
show a neutral warning. Expired and next30-day expirations are counted. Invalid/unknown
expiry dates and revoked records do not produce an all-valid claim. Mixed brokerage
linkage displays the verified count and a pending aggregate rather than claiming every
agreement is linked.

## Property editing

The existing property editor is extended, not replaced with a separate inventory.
Cards and the existing private media/location profile both expose “تعديل العقار”.
The editor uses current data, keeps account/record-scoped drafts, and supports physical
kind (including FLOOR/دور), existing property_use classification, rooms, lounges,
bathrooms, entrances, price, region, city, district, address and optional HTTPS media URL.
Existing classification names are reused instead of introducing a conflicting
usage_category column. Existing private media, deed attachments, GPS coordinates,
ownership links and import metadata are retained.

PATCH /api/properties/:id validates a whitelist and uses the caller's Supabase token/RLS.
Only active ADMIN/CEO/EMPLOYEE internal accounts may edit. The UI waits for confirmed
persistence, displays failures and retains the form/draft for retry. It updates context
without a page reload after success. Ownership and representative changes continue
through their existing audit workflows rather than the specification editor.

Canonical specifications fall back to original imported Excel facts until explicitly
edited. Per-field edit markers distinguish an intentional null from an unpopulated
new column, including partial PATCH requests. Zero is rendered as0; missing values use
an em dash. Unambiguous imported price text can be displayed/prefilled without modifying
the original; ranges and ambiguous prices remain unknown. The card's location header,
blue kind/use pill, green media button, specification grid, price row and owner/agent
footer follow the requested RTL layout. The import function keeps deed reuse,
idempotency and private attachment behavior while accepting FLOOR.

## Four-part report

/financials/daily-reports is now the KR closing workspace. The four tabs are main report,
Hatif operational appendix, lead classification appendix and analysis/next-day plan.
All four sections print together on A4; a small synthetic report was verified as exactly
four PDF pages. Long real tables may continue across pages; rows are not clipped merely
to force a page count. Printing uses the browser's Print/Save PDF command and preserves
the report's revision, provenance warnings and actual update timestamp.

The original AI report screen remains at /financials/daily-reports/legacy, linked from
KR. Existing ai_daily_reports, financial summaries, calculations and the AI API are not
deleted or rewritten. The requested official sign-off names and complete company legal
identifiers are displayed as document labels; the actual preparing user and previous approving users
are retained in historic snapshots when applicable. Current reports show the actual
preparer and update time, without fabricating an approval signature. The supplied
telephone footer was incomplete and is omitted.

Preparation reads existing CRM activities, task delegations, current KR agenda tasks,
new CRM leads, financial_transactions, properties and managed-property availability.
Read failures in essential sources block preparation; optional unavailable sources
produce warnings. Bounded editable content is validated before saving. Oversized source
sets are rejected rather than silently presenting incomplete totals.

The deployed source's financial column mapping is amount / tax_vat / net_profit /
transaction_type(INCOME/EXPENSE), matching existing dbService aliases. Verify this mapping
on the actual host before migration. KR received totals come from income amounts; VAT
comes from recorded income tax. New third_party_amount must be explicitly classified;
null does NOT mean zero. Office revenue is received minus recorded income VAT, third-party
amounts and recorded expense net_profit; it remains unknown while any income's trust
classification is missing. This KR classification does not change the Earnings screen's
existing calculation. Zero transactions show the actual registered-property count;
absence of ledger entries is not used to assert that no deals have closed.

A service-only SQL read links CRM activities to the private Hatif ingestion event log;
a user-editable creator label is not accepted as source evidence.
The existing Hatif ingestion retains activity timestamps, contacts and notes but not all
call direction, abandonment, waiting-time, callback and WhatsApp-delivery metrics.
Those metrics remain unknown until imported from a documented daily summary. Existing
Hatif signatures, workspace/channel scope, deduplication and outbound-event behavior
are unchanged. Lead category and temperature remain unclassified until explicitly
recorded/imported; operational priority is not silently equated to lead temperature.
Commercial availability counts only explicitly commercial active management records;
mixed-use units are not guessed to be commercial.
Estimated pipeline values derive from recorded budgets and are marked incomplete when
values are missing. These are estimates, not collected revenue.

## Import and editing

POST /api/financials/kr/import accepts an authenticated executive bearer token and JSON:
- event_id: stable UUID for this import event.
- report_date: valid Gregorian YYYY-MM-DD.
- revision: current revision when replacing an editable report.
- content: full validated KrContent from lib/kr/schema.ts.

The UI exports this same JSON envelope and accepts a JSON file up to1 MiB. It can ingest
structured Claude/Hatif output without inventing a connected Claude service. The content
includes summaries, task/improvement tables, all communications KPIs, calls, followups,
carryovers, contacts, analysis.source/bullets, strategies and tomorrow actions. Financial
facts are always collected on the server and cannot be overridden by imported JSON.
Use analysis.source=claude only for actual Claude output; manual edits set it to manual.
No API key or production report is included in the repository. Import replay is
idempotent by event UUID/digest; changed event reuse and stale replacement fail.

## Direct management visibility and editing

Admins and CEOs can prepare, save or import for any selected valid report date,
including an old approved report, without reopening or requesting approval. Each
successful write stores status PUBLISHED and becomes directly available to management.
Legacy statuses remain readable, and the migration does not rewrite existing reports
or their signatures. The removed SUBMIT/APPROVE/RETURN/REOPEN operations are rejected.
Every human update requires the current revision; stale writes fail with409.

Admin and CEO are the only current report users and editors. There are no other managers
yet. A future manager must first have an existing active internal HR/EMPLOYEE account,
then an Admin or CEO explicitly grants read-only KR access using “صلاحية مشاهدة تقارير
الإدارة”. This changes neither their global role nor their financial permissions.
Viewers can select dates, read reports/history and export PDF/JSON. They cannot edit,
import, schedule reports or grant access. Revocation or account deactivation takes effect
on the next API request. External and history-only accounts remain excluded. Normal
employees/HR receive no report access merely because of their role.

The profile endpoint computes kr_reports on the server. The API rechecks the active
account and database grant on every report read; hiding UI controls is not authorization.
The private kr_report_access RPC is service-only SECURITY INVOKER. Grant changes are
recorded in a private append-only event table. Both new private tables have RLS and no
anon/authenticated grants. No future managers are pre-granted access by the migration.

The service role retains SELECT on portal_private.accounts from the previously applied
20261026170725 permission repair. BYPASSRLS alone does not grant table access. Preserve
that grant; browser roles receive no account-table access.

## History and agenda synchronization

Every update archives the complete prior report, its historic approval metadata and
agenda before saving the next revision. Admins, CEOs and explicitly authorized report
viewers can download previous snapshots. The service role has no archive UPDATE/DELETE
privilege. Scheduled changes have an honest null actor ID and a scheduled actor label;
no executive is impersonated. All financial facts remain server-sourced.

Saving, refreshing sources, importing and scheduled publication synchronize the next-day
plan in the same database transaction as the report. Unchanged current tasks preserve
completion; changed/restored tasks become PENDING; new tasks insert once; removed tasks
become noncurrent without deletion. Invalid plans roll back the entire report/agenda edit.
Each action has a UUID, owner, action, contact, explicit-offset deadline and success
indicator. Its Riyadh date must be the day after the report date. Unique active internal
account-name matches assign automatically; ambiguous/unresolved owners stay unassigned.

Existing agenda permissions remain scoped separately: management sees all tasks, ordinary
employees see and complete only assigned current tasks. A read-only report grant does
not broaden agenda-write or unrelated financial permissions. Noncurrent tasks stay out
of source collection, calendar, agenda and employee status updates. No notifications
are sent outside the app.

## Daily22:00 scheduling

The existing timer and private KR_SCHEDULER_SECRET remain in place. The app and database
both enforce Riyadh time. The UI calls the time report_time; the stored approval_time
column and read alias remain for compatibility with old installations.

At the due time a new report is prepared and published directly to authorized management,
with its agenda synchronized. If a report already exists, its manual content and facts
are preserved and archived before scheduled publication. scheduled_at makes repeated
calls idempotent. Unavailable essential sources fail and retry; missing prior days are
not silently backfilled. Scheduling never fabricates a CEO signature or sends external
messages. Secrets stay server-only, outside source and logs.

## Upgrade from the current historical-editing release

The current live image is
sha256:ef1eaff673c151d9d82a796077c787247611d8ae6de584c6b7e4a0d8c38ca8d5.
Apply **only** supabase/migrations/20261027002704_kr_management_reports.sql before the
matching management-report app. The base KR, account-read and report-revision migrations
are already applied. Never rerun historical migrations or fixtures against production.

Use the guarded release package to verify the exact live image/runtime/schema, create
and validate a private backup, build the candidate and check an isolated preview first.
After specific production approval, pause the existing scheduler, apply the named
transaction, switch only the app, verify reads/runtime and resume the timer. Preserve
all runtime settings, Hatif configuration, both networks, loopback port3020, routing,
restart policy and the scheduler secret. Keep the exact previous container for rollback.

Emergency rollback restores that original app and pauses the timer. Keep all reports,
manager grants, archives, events and task records. Do not restore a database dump over
newer customer activity or drop the additive schema. The old app uses the previous
approval flow and cannot manage direct publications; restore the matching app before
resuming scheduled reports or making report edits.

## Verification

Required existing checks: npm run build, npx tsc --noEmit, node tests/hatif.cjs,
node tests/drafts.cjs and node tests/navigation.cjs.
New checks: node tests/kr.cjs, node tests/kr-workflow-db.cjs (historic migrations),
and node tests/kr-management-db.cjs (current direct-publication/access/agenda workflow). PGlite0.3.14 is a pinned
DEV dependency used only for an isolated PostgreSQL migration/workflow/RLS test.
Browser suites tests/kr-browser.cjs and tests/workspace-browser.cjs require Playwright,
Chromium and a local production-build Next server with .env.example fixtures; every
backend/Auth/provider request is mocked. No customer records or credentials are used.
The CI workflow runs the build/typecheck and database/API/unit checks on Node20/22.
These checks do not establish production schema parity or external provider health.
