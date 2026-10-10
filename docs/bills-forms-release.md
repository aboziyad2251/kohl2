# Bills & Forms release

Implemented `/bills-forms` within the existing Next.js application. Sidebar and page access permit active Admin/CEO and employees; HR and external accounts are excluded. No AI service is called. Templates render in the browser, with A4 print / Save as PDF, Gregorian input plus Umm al-Qura Hijri display, integer halala calculations, optional 15% VAT for invoices, and Arabic/English currency words.

Templates: receipt, payment voucher, rent/sale invoice, unit handover. Styles follow the green header/footer and signature structure of the supplied Kohl forms; these are new HTML templates, not pixel-identical copies or full lease contracts. Signatures stay blank. QR is a labelled placeholder with inspectable five-field TLV data, not a certified ZATCA invoice implementation.

## Approved database migration

`supabase/migrations/20261009225626_bills_forms.sql` was applied on 10 October 2026 after explicit user approval, live prerequisite inspection, isolated acceptance and backup restore verification.

- Two private tables, RLS enabled, no direct browser grants: annual counters by document kind and immutable document snapshots.
- Narrow authenticated RPC checks active private account role on every call. Admin/CEO/EMPLOYEE can issue; only Admin/CEO can override numbers.
- Counter UPSERT serializes concurrent allocations. Number uniqueness enforced globally. Override advances the counter and cannot reuse an issued number. IDs REC/VOU/INV/HND follow the requested format; receipt/payment correspond to the reference RV/RP templates.
- A request UUID advisory transaction lock makes duplicate submissions idempotent, and rejects a changed retry payload or another actor's UUID. Allocation and snapshot insertion are one transaction; failed inserts roll back the counter.
- Snapshot stores input, authoritative integer-halalas totals and template version. No update/delete/list API is granted. Payment vouchers are generated documents; they do not initiate payment or change ledger balances.
- Browser drafts work before migration. Official issuance fails clearly until database activation. PDF printing is performed by the browser, not a server PDF service.

## Deployment and optional subdomain

Deployment was approved and completed after isolated authorization/concurrency testing. Preserve the current VPS edits and image override; do not invoke deploy.sh blindly.

The sidebar intentionally uses the authorized internal-route alternative so the existing session is reused. Optional `Bills-form.kohlestate-ksa.online` should redirect to `https://app.kohlestate-ksa.online/bills-forms` to avoid separate-origin localStorage authentication; configure DNS/TLS and reverse proxy separately. Do not silently broaden cookie scope.

## Verification

Production build passed using a temporary isolated dist directory outside the filesystem sandbox; generated routes include both page and API. Local model assertions passed. Lint cannot run because this repository has no ESLint configuration and Next prompts for setup. TestSprite 0.14.0 auth status returned service unavailable / fetch failed, so remote verification is unverified. Database migration and production routing remain unverified pending approval.

Run `node scripts/test-bills-forms.cjs` for calculation/schema/TLV/date checks. Before production: concurrent issue requests, repeated UUID, inactive/HR/external denial, executive override collision/advance, failed insert rollback, mobile entry and multi-page A4 print with long Arabic notes. Do not test issuance on production without an agreed fixture policy.

## Local browser verification — 10 October 2026

`node scripts/test-bills-browser.cjs` passed on `http://127.0.0.1:3112` with fake browser sessions and all business/Auth/REST calls intercepted. No production records were read or changed.

- Admin, CEO and Employee: all four forms, invalid input prevents dispatch, invoice VAT rounding, third-party funds disable VAT, failed issuance retry retains UUID, issued inputs freeze, new document unlocks, print trigger, and desktop/mobile overflow checks.
- HR denied the page; Owner/Tenant/Broker redirected to portal. Anonymous page redirects to login. Actual local API POST without bearer token returns 401.
- Print media screenshots reviewed; fixed application header decoration appearing over the invoice by hiding application chrome and backdrop effects in print.
- Model tests, TypeScript and diff whitespace check passed after the print fix. TestSprite auth service still unavailable; no TestSprite run performed.

These are UI tests with mocked issuance, not database authorization/concurrency tests. No migration applied. The local dev server uses existing `.env.local` configuration: ordinary manual login connects to the configured Supabase instance; the automated test sessions are isolated. Until database activation, manual usage should be limited to draft preview/printing.

## Local login correction — 10 October 2026

The original local anon key was rejected with HTTP 401 before credential validation. Refreshed only the ignored `.env.local` public Auth key and URL from the running app's read-only configuration, and aligned the Google provider flag. Public HTTPS Auth settings now return 200; no account passwords or production configuration were changed.

The local dev server is started with `NODE_OPTIONS=--use-system-ca` so Node uses Windows certificate trust while retaining TLS verification. For manual restarts: `$env:NODE_OPTIONS='--use-system-ca'; npm run dev -- --hostname 127.0.0.1 --port 3112`.

Login UI now distinguishes `invalid_credentials` from connection/configuration, rate-limit and unconfirmed-email errors. Five classification tests and TypeScript passed. Actual account credential acceptance awaits the user's retry.


## Production installation — 10 October 2026 (Riyadh)

Installed after explicit user approval at `https://app.kohlestate-ksa.online/bills-forms`. Sidebar uses the internal route and existing approved-account session. No separate subdomain/DNS change was required.

- Final image: `kohl-bills:20261010`, digest `sha256:991eb7518c61e225a37bf4055bfc5bd538a8b0b642357ceb0ec8fc0ec3447c9b`.
- Current private backup/Compose image override: `/home/debian/backups/kohl-bills-20261009T233232Z/app-image-override.json`. Original migration backup is `/home/debian/backups/kohl-bills-20261009T232757Z`.
- Migration `20261009225626` SHA-256: `531d69bae323d46ac4ad941fbd0daf2a71570b7353e0e421103439121fc29e58`. Applied once in a transaction; the final image update verified its receipt and retained existing schema/documents.
- Full PostgreSQL backup restored successfully before installation and before the final image update. Deployed source/config was backed up; no Git reset was used. All runtime environment values are unchanged, including Google enabled and email recovery disabled. No passwords or signing keys were changed.
- Real isolated Auth/REST/Next acceptance passed on the final digest: all four kinds; Admin/CEO/Employee issuance; 20 concurrent unique consecutive numbers; 5 same-request retries; changed/foreign retry rejection; executive overrides and collision/sequence advance; annual reset; cent rounding; invalid inputs; Auth metadata cannot promote roles; HR/external/inactive denial in API and direct RPC; private table grants/RLS; failed snapshot rollback. The restored test database and this release's loopback-only services were removed.
- Public login, recovery and Bills routes return 200. Protected attention, dashboard, user administration and Bills issuance reject anonymous callers with 401. No production document was created for testing.
- Maximum accepted amount `999999999.99` with VAT is now included in the currency-word regression tests. Local model/error tests and TypeScript passed after that correction.
- Three TestSprite public checks passed after initial deployment: invalid credentials (`731f8299-e2d6-4fc2-b16a-8c5631bb155d`), Google/no-public-registration (`10c18c37-9652-4a81-8c72-ae83cb8fbd80`), Bills authentication guard (`6c7a09dc-3c8e-4019-a5cf-dc5c0deef9db`). These checks do not receive real credentials or issue documents. The subsequent image correction only changed the maximum currency-words boundary and passed the complete isolated acceptance suite again.

[TestSprite Bills authentication verdict](https://www.testsprite.com/dashboard-v3/o/262d11f4-a3ed-5e4f-acd5-0bc69ada0f6a/projects/7930d491-00e4-4183-a083-9d1607d945f9/test-cases/b96dfb83-1821-4ce5-a1dd-53fec56490e6)

Operational helpers: `scripts/build-bills-release.py`, `scripts/verify-bills-release.py`, `scripts/deploy-bills-release.py`. Stage: `/home/debian/projects/kohl-bills-release-20261010`. Treat these as this release's checkpoints, not generic rerunnable deployment commands; inspect live state and receipts first. Image rollback uses the private `rollback-image.json` from the chosen backup and retains additive Bills schema/documents. Do not restore an older database over newly issued documents as a routine rollback.

QR remains a labelled TLV placeholder, not a completed ZATCA integration. No automated payment or ledger posting is performed. Source changes are preserved locally and in the live checkout; GitHub publication was not requested/performed.
