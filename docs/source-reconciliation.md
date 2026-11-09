# Production source reconciliation — 9 November 2026

## Provenance and scope

The restored main image `sha256:4128d746c87f15ff345a57de78be75b83c0551da0b368f202250484eb8c874d3` was built from `aboziyad2251/kohl-crm-cloud` commit `bab4aaa37d557e06d2d2a4dee1f847f959e944d5`, tree `27afe3ef85b9f000b4dfedd6b3f4c94b126d3eea`. This was established using `/home/debian/kohl-releases/audit-broker-import-bab4aaa-e_vdilo2` release provenance and its candidate/rollout image identity. All 359 retained source blobs matched the recorded GitHub blob SHA values. The original Git commit was fetched directly, rather than reconstructing the navigation from compiled output.

The original `kohl2` checkpoint is `e38c9ff3352e7866c9445ff854f6ef49836f5a8e`. The two repositories have separate Git histories; the production source was imported as a reviewed snapshot without discarding Kohl2's deployment history, operators' scripts or handoff. Existing dirty production source was never overwritten.

Recovered source includes grouped navigation/search/favorites/themes/mobile behavior; Today/calendar/settings/activity/audit; the legacy and current financial-report routes; management report/agenda permissions; audit actor isolation and redaction; smart property import; KC-M v3; property/deed/map/media; scoped Hatif ingestion; and their original tests and historical SQL.

Latest Kohl2 changes retained over that snapshot: the two tested account pages, AccountShell/ExternalPortalShell, own-password UI links, BrokerPanel/PortalDashboard design and appended broker CSS. Shared authorization, audit, navigation, data services and newer main pages use the canonical production source. Browser fixture storage now supports the isolated placeholder Auth origin; one recovered browser suite accepts the standard Chromium-path environment override for Windows.

## Regression gates and validation

- `npm ci`, `npm run build`, `npx tsc --noEmit`: passed. Build/run used loopback placeholder Auth/backend values and no production credentials.
- `node scripts/check-release-baseline.cjs`: passed for all 78 canonical route-manifest entries and all six menu categories. The baseline was read directly from the running main container. Additive routes are allowed; missing existing routes fail CI.
- Mock/isolated PostgreSQL suites passed: `hatif`, `drafts`, `navigation`, `kr`, `kr-workflow-db`, `kr-management-db`, `audit`, `audit-db`, `broker-summary`, `property-upsert`, `property-upsert-db` under `tests/`. PostgreSQL fixtures used isolated PGlite databases, never the production database.
- `tests/workspace-browser.cjs`: passed RTL groups, Arabic search/keyboard, favorites and account isolation, collapse, deep links/history/reload, nested highlights, drafts, all themes, mobile drawer/Escape/overflow, role restrictions and external routing. Desktop calendar and mobile-menu screenshots were visually inspected.
- `tests/kr-browser.cjs`: passed report editing/import/agenda, saved-version download, executive access, future read-only grants/revocation, PDF and 320–1440px layout checks.
- `tests/audit-broker-import-browser.cjs`: passed KC-M two-page A4 output, template download, import ambiguity/create/update/amenities, audit filters and grant/revocation using synthetic fixtures.
- Broker design acceptance passed in Arabic/English at 1440px and 390px, with no horizontal overflow or broker payout-edit controls. The mobile screenshot was visually inspected.
- `scripts/test-password-self-service.cjs`: passed all seven roles including the portal own-password links, disabled/anonymous/unapproved guards, failed link handling, single implicit-session initialization and bilingual generic recovery requests.
- TestSprite local smoke passed four recorded steps. Test `35f36702-1c82-4392-8481-698911f7bdfa`, run `c3d13d66-5696-47f3-80e6-445a92b9a1e4`. [Dashboard](https://www.testsprite.com/dashboard-v3/o/262d11f4-a3ed-5e4f-acd5-0bc69ada0f6a/projects/7930d491-00e4-4183-a083-9d1607d945f9/test-cases/35f36702-1c82-4392-8481-698911f7bdfa).

CI runs the build, typecheck, baseline guard and recovered mock/isolated DB suites on `main`, all `codex/**` branches and pull requests. Browser evidence stays in ignored `tmp/pdfs/reconciliation-*`; private TestSprite receipts stay in `.portal-stage`. Docker excludes operator inputs, environment files, dumps and private checkpoint artifacts. Root `deploy.sh` exits before performing any network or deployment action.

## Continue safely

Use the reconciled GitHub branch and `/home/debian/projects/kohl-reconciled-20261109` clean source mirror for future candidate builds; `SOURCE_COMMIT` records its exported Git revision. Never reuse the old dirty `/home/debian/projects/kohl-crm-app` as a build baseline or hard-reset it. The old source and all private checkpoints remain available for forensic comparison.

Production remains on the main image above plus broker image `sha256:223b615202c1e8553c15b60c59d75e3079acd72f28c0f1a256ef4544960a76a6` and account image `sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850`. NPM routes `/portal` and the exact account paths into their separate frontend namespaces. The reconciliation does not deploy a new image, migrate a schema, rotate keys or change accounts. Source acceptance is complete; a future release still requires exact-image isolated acceptance and explicit cutover authorization.

Historical `source-manifest.json` describes the October Cloud export; it is retained as provenance and must not be mistaken for the combined source's current release manifest. Historical migration files are source only: verify the live migration ledger before proposing any database change. An npm install reported six dependency advisories in the recovered lockfile; dependency upgrades were not mixed into source recovery.
