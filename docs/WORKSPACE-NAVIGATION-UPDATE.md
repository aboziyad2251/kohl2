# Workspace navigation update

Implemented locally on 2026-10-25 following `NAVIGATION-AUDIT.md`.

## Delivered

- Six labeled Arabic navigation groups, shorter labels, consistent icons, and optional collapsing. The current group stays open. All 16 original destinations keep their routes and permission keys.
- Account-specific browser favorites, synchronized between tabs, validated against known navigation IDs and filtered by current permissions. Stars work in both regular navigation and search results. Settings provides a full favorites picker and a navigation-preferences reset.
- Arabic-tolerant section/service search in the sidebar and a keyboard-accessible header dialog (`Ctrl/Cmd+K`, arrow keys, Enter, Escape). This searches permitted destinations, not customer records.
- Shared navigation metadata supplies complete header titles, route access mapping, and nested-page highlighting. Mobile quick navigation now includes CRM.
- URL-selected tabs for CRM, ownership, property management, employees, archive, and portals. Invalid or unauthorized tab names fall back to the default. Next's integrated History API preserves mounted form state and supports reload, Back/Forward, and direct links without changing pathname-based draft keys.
- **أعمال اليوم**: an executive work view reusing existing overdue/due-soon, renewals, approvals, maintenance, and commission alerts. Shortcuts link to collections, portal maintenance, commissions, and follow-ups.
- **التقويم والمواعيد**: a monthly calendar and agenda with month/source/day filters and links back to the original workflows. Existing user-token/RLS reads supply CRM dates, contract expirations, management contract expirations, powers of attorney, and leave start dates. Executive-only portal data supplies scheduled maintenance visits and dues. Dates and scheduled times use Riyadh time. Partial failures and per-source record limits are visible.
- **سجل النشاط**: an executive-only recent activity view with search, source/date filters, and Show more. It retains distinct ownership, portal, and access audit sources, with namespaced IDs and links to original logs. It does not infer deduplication or expose audit before/after payloads. It shows up to 100 recent entries per source rather than claiming complete audit history.
- **الإعدادات والتكاملات**: an executive-only hub for appearance, password changes, account administration/lease-end policy, favorites, and workflow shortcuts. A protected status endpoint reports a user-scoped database read, integration configuration flags, and the last CRM activity recorded under Hatif's integration name. Configuration is explicitly distinguished from tested provider connectivity; no secrets are returned and no external test events are sent.
- Daily-report fallbacks now contain calculated observations and explicit provenance instead of invented transactions, pending agencies, compliance claims, or guaranteed outcomes. Vacancy comes from active managed-property records, reports unknown when coverage is absent, and is labeled as current rather than historical. AI output receives shape validation, input validation, and an explicit AI label; failed/unconfigured generation falls back to a calculated summary. Existing saved reports without provenance are labeled accordingly. Existing financial calculation and reset behavior is retained.
- Removed the header's unmeasured static “إيجار نشط” connection badge. Settings explains the available internal contract workflow and unmeasured external connection status.

## Access and data preservation

No migration, dependency upgrade, permission-policy change, deployment, or production mutation is part of this update. Existing map/privacy, deed/property import, private attachments, user provisioning, and Hatif ingestion code remain intact.

New calendar reads authenticate with the existing server identity helper, reject external roles, and query through the user's existing RLS-scoped client. HR only receives leave dates; staff receive their existing permitted business sources. Portal dates and the activity/status endpoints require Admin/CEO. Page-level navigation checks are supplementary; the data endpoints enforce their own access checks.

Maintenance sources remain separate. Financial records and owner statement calculations have not been merged. Favorites store route IDs only, not customer data or credentials. Existing routes and draft scopes remain unchanged.

## Verification and local review

Required checks:

```sh
npm run build
npx tsc --noEmit
node tests/hatif.cjs
node tests/drafts.cjs
node tests/navigation.cjs
```

Final results: build **PASS** (33 generated pages), standalone TypeScript check **PASS**, Hatif tests **PASS**, draft tests **PASS**, navigation/workspace tests **PASS**, and `git diff --check` **PASS**.

`tests/navigation.cjs` uses mocked data to check legacy route preservation, role-filtered Arabic search, malformed/account-scoped preferences, nested-route matching, Riyadh/leap dates, truthful financial summaries, API role gates, user-token reads, incomplete sources, record limits, source identity, and secret-free status responses.

`tests/workspace-browser.cjs` exercises the actual UI with isolated mocked Auth/backend responses. Run a local server with the placeholder `.env.example` configuration, then run:

```sh
KOHL_TEST_ORIGIN=http://127.0.0.1:3000 node tests/workspace-browser.cjs
```

The browser script needs Playwright and Chromium available in the test environment. `KOHL_CHROMIUM_PATH` can select Chromium, and `KOHL_TEST_ARTIFACTS` sets the screenshot directory (default `/tmp/kohl-workspace-ui`). No production login is needed. Screenshots contain synthetic fixture records only.

Final browser result against the production build: **PASS** for grouped RTL navigation, Arabic search and keyboard controls, favorites persistence/account separation, collapsing, tab deep links/history/reload, nested-page highlighting, draft survival, three appearance modes, mobile drawer/Escape/navigation, horizontal overflow, staff restrictions, and external portal routing. Screenshots: `desktop-calendar.png`, `desktop-settings.png`, `mobile-menu.png`, and `mobile-settings.png` under `/tmp/kohl-workspace-ui`.

Additional responsive checks: **PASS** for calendar/settings at widths 320, 390, 768, 1024, and 1280 pixels. Run with `KOHL_TEST_VIEWPORTS_ONLY=true` to repeat this focused check.

Office continuation review: corrected the calendar's Today button so that returning from another month keeps today's date selected. The browser test now covers this transition explicitly.

Final UI refinement adds compact group/favorite counts, plain mobile section headings, a clear-search control, category context in search results, a category/page path in the header, selected-state feedback for saved tab shortcuts, role-appropriate calendar source choices, and Arabic calendar status labels. Favorites and source filters continue to use the existing permissions; these presentation changes do not grant access to additional data.

The local environment uses Node 24.19.0. The initial release commit `5ddd6d1` also passed GitHub Actions build/type/mock tests on Node 20 and Node 22 in run `40214571824`; inspect the final PR head's checks for the refined version. These checks do not establish deployed database policy/schema parity, actual provider health, email delivery, tax compliance, PDF generation, or production login behavior. Validate these separately in an isolated configured test backend before production rollout.

Release preparation is recorded in `PRODUCTION-RELEASE.md` and [draft PR #1](https://github.com/aboziyad2251/kohl-crm-cloud/pull/1). It adds CI checks and Docker context exclusions, without changing the existing runtime or deployment service.

## Rollout

Review the local diff and screenshots. Production deployment requires approval for this specific update under `AGENTS.md`. No historical migrations should be applied. Reverting the UI/API change requires no data rollback; unused route preferences can remain in the user's browser without affecting business records.
