# Ten standard forms — office handoff, 10 October 2026

## Proposed behavior

`/bills-forms` is now a catalog of 14 separate document entries. The four original receipts/invoices/handover forms remain available at `/rec`, `/vou`, `/inv`, `/hnd` beneath that route. Each new document has its own editor, original page artwork, variables and numbering code:

| Code | Document | Route suffix | Pages |
| --- | --- | --- | --- |
| KP | عرض خدمات / مقترح | services-proposal | 2 |
| KL | خطاب رسمي | official-letter | 1 |
| KM | مذكرة داخلية | internal-memo | 1 |
| KQ | عرض سعر | quotation | 1 |
| KR | تقرير اليوم | daily-report | 1 |
| KB | الموازنة المالية اليومية | daily-budget | 1 |
| KA | أجندة ومحضر اجتماع | meeting-minutes | 1 |
| KC-L | عقد إيجار شقة سكنية | residential-lease | 2 |
| KC-B | عقد وساطة عقارية | brokerage-contract | 2 |
| KS | خطة محتوى المنصات | content-plan | 1 |

The supplied individual PDFs were visually inspected and rasterized at 300 DPI into 13 original A4 page backgrounds. Fixed clauses, corporate header/footer, signatures' blank lines and named preparer/CEO remain in the originals. Editable fields are limited to document variables. `docs/templates/kohl-unified-forms/standard-assets.json` records original PDF and page-asset SHA-256 hashes. The fixed artwork in the exported PDF is raster; interpolated values are browser text. No generated signature, AI API, account creation, payment, ledger posting, Ejar registration or public content posting is performed.

`lib/forms/templates.ts` declares the fields and PDF-point placement. Editors display only variable controls, with required/length/type/choice constraints. Multi-page documents retain the original page counts. Long text exceeding a cell is rejected before issuance rather than silently cropped. Live preview and draft print are client-side. Print waits for images/fonts; use A4, no margins, no browser headers/footers.

Proposals and quotations sum entered line totals and calculate the reference's 15% VAT with integer halalas; quotation quantities are descriptive and amounts are explicitly line totals. Arabic currency words use the existing deterministic utility. The daily reconciliation sums income/trust/tax, expenses and opening balance; trust paid is an input used to calculate unpaid trust and is not printed as an unlabelled field. These are document calculations, not an accounting integration. Rent installment totals must equal the entered rent when a payment schedule is supplied. Dates, commission percentage/fixed-fee exclusivity and trust disbursement bounds are validated.

## Database proposal — production not applied

Pending migration: `supabase/migrations/20261009235815_standard_forms.sql`.

Adds only `public.issue_standard_form(uuid,jsonb)`. Reuses `portal_private.bill_counters` and `bill_forms`, retaining private table RLS and existing grants. The old four-kind RPC is unchanged. The new function authorizes active private ADMIN/CEO/EMPLOYEE profiles; only ADMIN/CEO can override numbers. Anonymous execution is revoked. Auth metadata cannot grant roles.

The SQL embeds the generated field whitelist, validates strings/types/required fields/dates/amounts/choices/periods and rejects unknown fields. Numbering is per code/year; codes containing a hyphen are supported. A request UUID advisory lock serializes retries, immutable payload checks reject changed/foreign requests, counter upsert allocates sequences atomically, and snapshot insertion is in the same transaction. Snapshot `templateVersion` is 2. No new table, account-policy change or data deletion is proposed. PostgREST schema refresh follows the transaction.

Regenerate the pending whitelist after changing fields using `node scripts/generate-standard-schema.cjs`; this command writes SQL only. The user explicitly approved this new migration and deployment conditional on passing browser, print and isolated database tests: “أوافق بعد اجتياز الاختبارات”. That approval persists, but the latest request is to push source and continue from the office. Do not deploy during this handoff.

## Verification and remaining checks

Passed:

- `node scripts/test-standard-forms.cjs`: all ten schemas/field whitelists, types, dates, invalid overrides, A4 geometry, VAT rounding, daily balance, rent schedule, commission and SQL/TypeScript whitelist parity.
- `node scripts/test-bills-forms.cjs`: existing four-form calculation, validation, currency word boundary, Hijri and TLV regressions.
- `npx tsc --noEmit`.
- `npm run build` using temporary `.next-bills-check` output. Catalog, dynamic individual routes and new API compiled. Original `next.config.mjs` and `tsconfig.json` were restored byte-for-byte. Default `.next` build was blocked by an EPERM directory-write failure.

Additional checks passed after approval:

- `scripts/test-standard-browser.cjs`: all ten editors on Admin desktop and Employee mobile, all variables, catalog, immutable issuance, retry UUID, print invocation, responsive layout and real unauthenticated API 401. Business/Auth requests in this browser suite are mocked.
- Actual browser PDF exports: thirteen A4 pages across ten documents, with KP, KC-L and KC-B each two pages. All thirteen pages were visually inspected. Print stylesheet excludes the surrounding application and uses original full-page artwork.
- Existing four-form browser regressions: Admin/CEO/Employee access and HR/Owner/Tenant/Broker/anonymous denial passed.
- `scripts/verify-standard-release.py`: exact staged image against disposable production-copy database. Real fake-account Auth/API/RPC checks passed for all ten forms and three internal roles, original four-form regression, twenty concurrent allocations, idempotent and foreign/changed retries, overrides/collisions, hyphenated codes/year reset, invalid variables and amounts, private-role/deactivation/metadata denial, table grants/RLS, and rollback without consuming a number. New SQL was applied only to the isolated copy; test services/database were removed afterward.
- TestSprite 0.14.0 public authentication guard passed, run `1c2c2618-9573-4e01-baaa-19a18f9f967f`, test `b96dfb83-1821-4ce5-a1dd-53fec56490e6`. This public guard does not cover authenticated editors. Dashboard: https://www.testsprite.com/dashboard-v3/o/262d11f4-a3ed-5e4f-acd5-0bc69ada0f6a/projects/7930d491-00e4-4183-a083-9d1607d945f9/test-cases/b96dfb83-1821-4ce5-a1dd-53fec56490e6

Standalone ESLint has no configured workflow; no lint pass is claimed. The initial elevated browser attempt failed automatic review due to account usage limits; a later reviewed launch ran successfully.

## Exact staged checkpoint and next office work

Stage: `/home/debian/projects/kohl-standard-release-20261010`, built from preserved live source plus the extension. Image `kohl-standard:20261010`, immutable digest `sha256:84fd2c796afa276b02c80dca0fd2ba88465ab23b6d7d86f429abc8667fbd8b20`. Private stage receipts `standard-build.json` and `standard-acceptance.json` pin the image, source and migration hash. Staging is not deployment.

Visual review found remaining checkbox placement work: replace guessed mark coordinates with exact PDF box bounds, use a small SVG tick, and change KC-B fee payer (`borneBy`) into the two original checkbox choices. Derive the fee-type checkbox from percentage/fixed amount. Check long manual document numbers against header width. The current staged image passed functional acceptance, but these visual findings must be resolved before publication. Regenerate SQL if fields change, rerun model/browser/print tests, then restage, rebuild and rerun isolated acceptance for the final image and SQL. Never reuse acceptance for changed source.

`scripts/build-standard-release.py`, `verify-standard-release.py` and `deploy-standard-release.py` are prepared. The deploy helper has not run. Review its rollback handling for newly introduced source files before use, and inspect live state/source drift first. Keep full private source/database backups and verify restoration before production migration.

No production source, image, database or DNS change has been made for this extension. Production remains the four-form `kohl-bills:20261010` image `sha256:991eb7518c61e225a37bf4055bfc5bd538a8b0b642357ceb0ec8fc0ec3447c9b`, with override `/home/debian/backups/kohl-bills-20261009T233232Z/app-image-override.json`. Latest live check confirmed `issue_standard_form` absent. Preserve runtime settings and all deployed source edits; do not blindly run `deploy.sh` or the earlier deployment scripts. Keep additive document records during application rollback. Private fixtures, credentials, build logs, backups and generated QA proofs stay outside Git.
