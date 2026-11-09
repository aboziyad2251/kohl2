# Audit, broker summary and smart property import — implementation map

Prepared before implementation,2026-10-28. Baseline:da383da (322 source files match exactly).
No production migration/deployment is authorized by this implementation task.

## Feature1: audit

Create:
- supabase/migrations/20261028131651_comprehensive_audit_trail.sql
- lib/audit/context.ts
- lib/audit/server.ts
- lib/audit/client.ts
- components/audit/ExportObserver.tsx
- app/api/audit/route.ts
- app/api/audit/access/route.ts
- app/api/audit/export/route.ts
- app/api/auth/login/route.ts
- app/audit/page.tsx
- tests/audit.cjs
- tests/audit-db.cjs

Modify:
- lib/portal/server.ts
- app/api/portal/me/route.ts
- lib/portal/types.ts
- context/SecureAuthContext.tsx
- components/auth/AppShell.tsx
- app/login/page.tsx
- lib/navigation.ts
- app/financials/daily-reports/page.tsx
- app/property-management/page.tsx
- app/customer-orders/page.tsx
- app/archive/page.tsx
- components/archive/ExportArchiveReportModal.tsx
- components/forms/StandardEditor.tsx

All existing API mutation route modules receive the reusable withAudit wrapper:
- app/api/access/settings/route.ts
- app/api/access/users/[id]/route.ts
- app/api/access/users/route.ts
- app/api/bills-forms/route.ts
- app/api/bills-forms/standard/route.ts
- app/api/financials/ai-insights/route.ts
- app/api/financials/kr/access/route.ts
- app/api/financials/kr/import/route.ts
- app/api/financials/kr/route.ts
- app/api/financials/kr/schedule/route.ts
- app/api/financials/kr/scheduled/route.ts
- app/api/integrations/hatif/[kind]/route.ts
- app/api/portal/actions/route.ts
- app/api/portal/attachments/route.ts
- app/api/portal/documents/route.ts
- app/api/properties/[id]/profile/route.ts
- app/api/properties/[id]/route.ts
- app/api/properties/import/route.ts
- app/api/property-map/[source]/[id]/route.ts
- app/api/workspace/agenda/[id]/route.ts

Database triggers capture actual before/after changes, including direct authenticated
Supabase writes. Request events correlate API attempts/statuses with database events;
provider auth events cover successful password/OAuth logins and logout. The password
login endpoint records failures without passwords. Export requests are logged, not
misrepresented as proof that the browser saved a file. Secrets/identity documents are
redacted; audit data cannot be edited/deleted by app users. Admin/CEO view by default;
explicit read-only grants support future Operations Managers without promoting all staff.

## Feature2: reference-matched KC-M summary

Create:
- supabase/migrations/20261028131709_broker_summary_v3.sql
- lib/forms/broker-summary.ts
- components/forms/BrokerSummaryEditor.tsx
- components/forms/broker-summary.css
- app/bills-forms/broker-cooperation/page.tsx
- app/api/bills-forms/broker-cooperation/route.ts
- public/forms/kohl/KC-M-summary-1.png
- public/forms/kohl/KC-M-summary-2.png
- tests/broker-summary.cjs

Modify:
- lib/forms/templates.ts (remove eight-page KC-M fields)
- lib/forms/model.ts (remove obsolete KC-M validation/computation)
- app/bills-forms/page.tsx (new two-page summary entry)
- app/api/bills-forms/standard/route.ts (reject retired KC-M path)

The actual supplied two-page reference is used as immutable page artwork with measured
fillable overlays, preserving legal text, branding and A4 geometry. Existing issued
historical snapshots/counters remain; new submissions use version3 and the existing
private form ledger. Old KC-M issuance is disabled in the database as well as the UI.

## Feature3: shared canonical property import

Create:
- supabase/migrations/20261028131715_smart_property_upsert.sql
- lib/properties/import-model.ts
- lib/properties/import-match.ts
- lib/properties/import-server.ts
- components/ownership/SmartPropertyImportModal.tsx
- app/api/properties/import/context/route.ts
- app/api/properties/import/preview/route.ts
- app/api/properties/import/commit/route.ts
- app/api/properties/import/template/route.ts
- tests/property-upsert.cjs
- tests/property-upsert-db.cjs
- tests/audit-broker-import-browser.cjs

Modify:
- lib/types.ts
- lib/properties/specifications.ts
- components/ownership/PropertySpecifications.tsx
- app/ownership-properties/page.tsx
- app/property-management/page.tsx
- .github/workflows/workspace-checks.yml

A shared importer is accessible from Property Management and the canonical property
inventory. This imports properties, not financial management-contract terms. Existing
private deed-upload/legacy apartment import remains intact. New rows link only to
existing verified owner/deed records; ownership transfers use their existing workflow.

## Excel column mapping

The workbook contains Properties, field instructions and permitted account/deed lookup
sheets. First-row headers use these stable keys; Arabic labels appear in instructions.
A blank update cell preserves the existing field; __CLEAR__ explicitly clears nullable
fields. Numeric0 and booleanfalse are real values. Formula cells are rejected.

| Excel column(s) | Database mapping | Rules |
|---|---|---|
| property_id | properties.id (lookup only) | Existing UUID; new IDs assigned by server |
| property_code | properties.property_code | Optional unique code; normalized digit/case matching |
| property_name | properties.property_name (UI title) | Required for new records |
| property_type | properties.property_type | Residential / Commercial / Land |
| property_kind | properties.property_kind | LAND/APARTMENT/VILLA/FLOOR/BUILDING/SHOWROOM/SHOP/KIOSK/FOOD_TRUCK |
| property_use | properties.property_use | Residential / Commercial |
| building_name, unit_number | properties.building_name, unit_number | Legacy spreadsheet fallback retained |
| lessor_id | properties.lessor_id | Existing owner UUID; required for new records |
| ownership_document_id, document_number | ownership_document_id + existing document lookup | A deed can cover many units; never auto-update all its properties |
| license_number | properties.license_number | Optional; may be shared, ambiguity remains explicit |
| current_representative_id | properties.current_representative_id | Existing representative; transfers not silently imported |
| region, city, district, address | same-named properties fields | City/address required for new records |
| latitude, longitude | same-named properties fields | Paired coordinates, valid ranges |
| units_count | properties.units_count | Integer>=1 |
| rooms, lounges, bathrooms, entrances | same-named properties fields + edited flags | Integer0-100; rooms are bedrooms in template label |
| price | properties.price + price_edited | Nonnegative number; no guessed currency period |
| media_url | properties.media_url | HTTPS only; no private media/deed URL replacement |
| map_visible, map_purposes | same-named properties fields | Boolean; MANAGEMENT|RENT|SALE |
| notes | properties.notes | Optional text |
| master_rooms, maid_rooms, balconies, parking_spaces | properties.amenities keys | Nullable integer counts |
| area_sqm, property_age | properties.amenities keys | Nullable nonnegative values (m²/years) |
| floor_number | properties.amenities.floor_number | Nullable integer, basements allowed |
| elevator, ac, furnished, kitchen, pool, garden, security, disability_access | properties.amenities keys | true/false or Arabic نعم/لا; blank preserves |
| orientation | properties.amenities.orientation | Nullable text |

Exact IDs/codes match only a single record. Contradictory identifiers, shared deeds,
matching title/building+unit/location or fuzzy similarity>75% require a decision. A row
with no plausible match is NEW. Preview shows all patches and existing values; every
ambiguous row needs Update Existing/Create New/Skip. Confirm executes one transaction,
with stale-catalog checks and idempotent request replay. Duplicate targets and unique
identifier collisions are rejected; no last-row-wins overwrite.

## Final implementation and validation

Implemented 2026-10-28. Source-only: no live migration, app replacement, scheduler
change or real-record test has been performed. The previous management-report workflow,
Hatif configuration and historical deed/form/report records are preserved.

### Exact final file inventory

This is the final delta against source baseline da383da, including the reusable audit
wrapper and export integration at existing call sites. “Create” means absent from that
baseline. Several files serve more than one feature; the earlier feature map explains
those responsibilities. No source file is deleted; obsolete KC-M code is removed inside
the listed files and historical artwork remains available to old snapshots.

| Change | Exact path |
|---|---|
| Modify | `.env.example` |
| Modify | `.github/workflows/workspace-checks.yml` |
| Modify | `app/api/access/settings/route.ts` |
| Modify | `app/api/access/users/[id]/route.ts` |
| Modify | `app/api/access/users/route.ts` |
| Create | `app/api/audit/access/route.ts` |
| Create | `app/api/audit/export/route.ts` |
| Create | `app/api/audit/route.ts` |
| Create | `app/api/auth/login/route.ts` |
| Create | `app/api/auth/logout/route.ts` |
| Create | `app/api/bills-forms/broker-cooperation/route.ts` |
| Modify | `app/api/bills-forms/route.ts` |
| Modify | `app/api/bills-forms/standard/route.ts` |
| Modify | `app/api/financials/ai-insights/route.ts` |
| Modify | `app/api/financials/kr/access/route.ts` |
| Modify | `app/api/financials/kr/import/route.ts` |
| Modify | `app/api/financials/kr/route.ts` |
| Modify | `app/api/financials/kr/schedule/route.ts` |
| Modify | `app/api/financials/kr/scheduled/route.ts` |
| Modify | `app/api/integrations/hatif/[kind]/route.ts` |
| Modify | `app/api/portal/actions/route.ts` |
| Modify | `app/api/portal/attachments/route.ts` |
| Modify | `app/api/portal/documents/route.ts` |
| Modify | `app/api/portal/me/route.ts` |
| Modify | `app/api/properties/[id]/profile/route.ts` |
| Modify | `app/api/properties/[id]/route.ts` |
| Create | `app/api/properties/import/commit/route.ts` |
| Create | `app/api/properties/import/context/route.ts` |
| Create | `app/api/properties/import/preview/route.ts` |
| Modify | `app/api/properties/import/route.ts` |
| Create | `app/api/properties/import/template/route.ts` |
| Modify | `app/api/property-map/[source]/[id]/route.ts` |
| Modify | `app/api/workspace/agenda/[id]/route.ts` |
| Modify | `app/archive/page.tsx` |
| Create | `app/audit/page.tsx` |
| Create | `app/bills-forms/broker-cooperation/page.tsx` |
| Modify | `app/bills-forms/page.tsx` |
| Modify | `app/customer-orders/page.tsx` |
| Modify | `app/financials/daily-reports/legacy/page.tsx` |
| Modify | `app/financials/daily-reports/page.tsx` |
| Modify | `app/login/page.tsx` |
| Modify | `app/ownership-properties/page.tsx` |
| Modify | `app/property-management/page.tsx` |
| Modify | `components/archive/ArchiveDossierPrintModal.tsx` |
| Modify | `components/archive/ExportArchiveReportModal.tsx` |
| Modify | `components/archive/PdfViewerModal.tsx` |
| Create | `components/audit/ExportObserver.tsx` |
| Modify | `components/auth/AppShell.tsx` |
| Modify | `components/common/UniversalImportModal.tsx` |
| Modify | `components/common/UniversalPrintModal.tsx` |
| Modify | `components/crm/CrmDealPrintModal.tsx` |
| Modify | `components/employees/SalarySlipPrintModal.tsx` |
| Modify | `components/forms/BillEditor.tsx` |
| Create | `components/forms/BrokerSummaryEditor.tsx` |
| Modify | `components/forms/StandardEditor.tsx` |
| Create | `components/forms/broker-summary.css` |
| Modify | `components/ownership/PropertySpecifications.tsx` |
| Create | `components/ownership/SmartPropertyImportModal.tsx` |
| Modify | `context/DataContext.tsx` |
| Modify | `context/SecureAuthContext.tsx` |
| Create | `docs/AUDIT-BROKER-IMPORT.md` |
| Create | `lib/audit/client.ts` |
| Create | `lib/audit/context.ts` |
| Create | `lib/audit/server.ts` |
| Create | `lib/forms/broker-summary.ts` |
| Modify | `lib/forms/model.ts` |
| Modify | `lib/forms/templates.ts` |
| Modify | `lib/navigation.ts` |
| Modify | `lib/portal/server.ts` |
| Modify | `lib/portal/types.ts` |
| Create | `lib/properties/import-match.ts` |
| Create | `lib/properties/import-model.ts` |
| Create | `lib/properties/import-server.ts` |
| Modify | `lib/properties/specifications.ts` |
| Modify | `lib/types.ts` |
| Create | `public/forms/kohl/KC-M-summary-1.png` |
| Create | `public/forms/kohl/KC-M-summary-2.png` |
| Create | `supabase/migrations/20261028131651_comprehensive_audit_trail.sql` |
| Create | `supabase/migrations/20261028131709_broker_summary_v3.sql` |
| Create | `supabase/migrations/20261028131715_smart_property_upsert.sql` |
| Create | `tests/audit-broker-import-browser.cjs` |
| Create | `tests/audit-db.cjs` |
| Create | `tests/audit.cjs` |
| Create | `tests/broker-summary.cjs` |
| Create | `tests/fixtures/erp-db.cjs` |
| Modify | `tests/hatif.cjs` |
| Modify | `tests/kr-browser.cjs` |
| Modify | `tests/kr.cjs` |
| Create | `tests/load-ts.cjs` |
| Modify | `tests/navigation.cjs` |
| Create | `tests/property-upsert-db.cjs` |
| Create | `tests/property-upsert.cjs` |
| Modify | `tests/workspace-browser.cjs` |

### Complete template registry

Exactly45 columns, in this order. The workbook download is generated from this same
registry, so the UI parser, validator and template do not drift. Owners, Deeds and
Representatives sheets contain permitted existing-record lookups when downloaded from
the app; the review artifact deliberately contains no records. No example is imported
as a real property. UUID/code/deed/unit fields are formatted as text.

| # | Header | Arabic label | Stored field / lookup | Type / allowed values | Required NEW |
|---|---|---|---|---|---|
| 1 | `property_id` | معرّف العقار UUID — للمطابقة فقط | `properties.id (lookup only)` | uuid | No |
| 2 | `property_code` | كود العقار الفريد | `properties.property_code` | text; __CLEAR__ allowed | No |
| 3 | `property_name` | اسم العقار | `properties.property_name` | text | Yes |
| 4 | `property_type` | التصنيف العام | `properties.property_type` | Residential / Commercial / Land | Yes |
| 5 | `property_kind` | نوع العقار | `properties.property_kind` | LAND / APARTMENT / VILLA / FLOOR / BUILDING / SHOWROOM / SHOP / KIOSK / FOOD_TRUCK; __CLEAR__ allowed | No |
| 6 | `property_use` | استخدام العقار | `properties.property_use` | Residential / Commercial | No |
| 7 | `building_name` | اسم المبنى / المشروع | `properties.building_name` | text; __CLEAR__ allowed | No |
| 8 | `unit_number` | رقم الوحدة | `properties.unit_number` | text; __CLEAR__ allowed | No |
| 9 | `lessor_id` | UUID المالك المسجل | `properties.lessor_id` | uuid | Yes |
| 10 | `ownership_document_id` | UUID الصك المسجل | `properties.ownership_document_id` | uuid | No |
| 11 | `document_number` | رقم الصك المسجل — بديل UUID | `ownership_documents.document_number → properties.ownership_document_id` | text | No |
| 12 | `license_number` | رقم ترخيص العقار / الإعلان | `properties.license_number` | text; __CLEAR__ allowed | No |
| 13 | `current_representative_id` | UUID الممثل المسجل | `properties.current_representative_id` | uuid; __CLEAR__ allowed | No |
| 14 | `region` | المنطقة | `properties.region` | text; __CLEAR__ allowed | No |
| 15 | `city` | المدينة | `properties.city` | text | Yes |
| 16 | `district` | الحي | `properties.district` | text; __CLEAR__ allowed | No |
| 17 | `address` | العنوان | `properties.address` | text | Yes |
| 18 | `latitude` | خط العرض | `properties.latitude` | number; __CLEAR__ allowed | No |
| 19 | `longitude` | خط الطول | `properties.longitude` | number; __CLEAR__ allowed | No |
| 20 | `units_count` | عدد الوحدات | `properties.units_count` | count | No |
| 21 | `rooms` | عدد الغرف / غرف النوم | `properties.rooms` | count; __CLEAR__ allowed | No |
| 22 | `lounges` | عدد الصالات | `properties.lounges` | count; __CLEAR__ allowed | No |
| 23 | `bathrooms` | الحمامات | `properties.bathrooms` | count; __CLEAR__ allowed | No |
| 24 | `entrances` | المداخل | `properties.entrances` | count; __CLEAR__ allowed | No |
| 25 | `price` | السعر — ريال | `properties.price` | number; __CLEAR__ allowed | No |
| 26 | `media_url` | رابط وسائط HTTPS | `properties.media_url` | text; __CLEAR__ allowed | No |
| 27 | `map_visible` | إظهار العقار على الخريطة الداخلية | `properties.map_visible` | boolean | No |
| 28 | `map_purposes` | أغراض الخريطة مفصولة بعلامة | | `properties.map_purposes` | purposes; __CLEAR__ allowed | No |
| 29 | `notes` | ملاحظات العقار | `properties.notes` | text; __CLEAR__ allowed | No |
| 30 | `master_rooms` | غرف الماستر | `properties.amenities.master_rooms` | count; __CLEAR__ allowed | No |
| 31 | `maid_rooms` | غرف الخادمة | `properties.amenities.maid_rooms` | count; __CLEAR__ allowed | No |
| 32 | `balconies` | الشرفات | `properties.amenities.balconies` | count; __CLEAR__ allowed | No |
| 33 | `parking_spaces` | المواقف | `properties.amenities.parking_spaces` | count; __CLEAR__ allowed | No |
| 34 | `area_sqm` | المساحة — متر مربع | `properties.amenities.area_sqm` | number; __CLEAR__ allowed | No |
| 35 | `property_age` | عمر العقار — سنوات | `properties.amenities.property_age` | count; __CLEAR__ allowed | No |
| 36 | `floor_number` | الطابق — سالب للقبو | `properties.amenities.floor_number` | floor; __CLEAR__ allowed | No |
| 37 | `elevator` | مصعد | `properties.amenities.elevator` | boolean; __CLEAR__ allowed | No |
| 38 | `ac` | تكييف | `properties.amenities.ac` | boolean; __CLEAR__ allowed | No |
| 39 | `furnished` | مفروش | `properties.amenities.furnished` | boolean; __CLEAR__ allowed | No |
| 40 | `kitchen` | مطبخ | `properties.amenities.kitchen` | boolean; __CLEAR__ allowed | No |
| 41 | `pool` | مسبح | `properties.amenities.pool` | boolean; __CLEAR__ allowed | No |
| 42 | `garden` | حديقة | `properties.amenities.garden` | boolean; __CLEAR__ allowed | No |
| 43 | `security` | حراسة | `properties.amenities.security` | boolean; __CLEAR__ allowed | No |
| 44 | `disability_access` | تهيئة لذوي الإعاقة | `properties.amenities.disability_access` | boolean; __CLEAR__ allowed | No |
| 45 | `orientation` | الواجهة / الاتجاه | `properties.amenities.orientation` | text; __CLEAR__ allowed | No |

Blank cells preserve current values on UPDATE. `__CLEAR__` explicitly clears nullable
fields; map_purposes uses an empty array. Numeric0 and booleanfalse are retained.
Cleared unit/building fields have explicit edited flags, so the preserved original
spreadsheet metadata cannot silently restore the old value. Existing amenities are
merged by key. New properties receive server UUIDs and may link only existing owners,
deeds and representatives. Updates cannot silently transfer any of those relationships.

Imports are limited to5MB files,500 populated rows,10000 scanned worksheet rows and
10000 existing properties. Formula cells and unsafe numeric identifiers are rejected.
Fuzzy matches above75%, shared identifiers and contradictory IDs require a choice.
At most20 candidate cards are shown per row, with the total and a request for a more
specific identifier when needed. Unresolved rows, duplicate update targets and duplicate
normalized code/deed-unit keys block confirmation. A unique code cannot be reused by
“Create as New”; correct or clear it explicitly before importing.

The actor-scoped server preview expires after1h. Commit locks the affected inventory and
rechecks a SHA256 catalog/owner/deed/representative snapshot. Any stale preview, row error
or uniqueness failure rolls back the whole batch, including its audit events. Retrying
the same request returns its prior result; changed decisions cannot replay that request.

### Access and audit behavior

Admin and CEO may view audit by default. There are no Operations Manager accounts yet:
Admin/CEO can explicitly grant a future active internal HR/Employee account read-only
audit access from the audit page. This does not promote its global role or give it user
provisioning rights. A revoked viewer loses access and the UI clears its previous rows.
External and history-only accounts remain excluded.

Actual database changes produce atomic before/after row events. API envelopes record
attempts and response status, authentication records actual provider outcomes, and bulk
import adds its summary. These separate streams are labeled by `details.source` and
correlated where request metadata exists. Direct authenticated Supabase writes receive
the database actor from JWT, not a browser-supplied actor header. OAuth/native successful
auth events come from Supabase auth.audit_log_entries; password failures come from the
new application login endpoint. No fabricated historical backfill is created.

Application roles cannot insert, update or delete audit rows. Narrow private definer
functions append scrubbed events and change only the checked audit-viewer capability;
public service RPCs are invoker functions and executable only by service_role. Queries
use RLS and `(select auth.uid())`-compatible checks. Credentials, identity numbers, IBANs,
private file paths and signatures are redacted; oversized event contents are bounded.
The private schema must remain excluded from exposed PostgREST schemas.

`AUDIT_TRUST_PROXY=false` is the safe default. Enable it only when the actual reverse
proxy overwrites forwarded addresses and the app cannot be bypassed. Until then IP is
null when it cannot be verified; user agent is captured from the request when available.
Explicit UI export buttons await a persisted export-request event before generating the
file or opening print. Native browser print/download observation is best effort; an
EXPORT event records a request, not proof the user saved a file. A request-envelope
logging outage after a completed mutation is reported server-side; its row trigger and
actual data change remain atomic. Database logging failure aborts the data write.

### KC-M reference and compatibility

The supplied blank two-page PDF is rasterized to180dpi page artwork and filled with
measured overlays. Brand, legal text, date/share fields, six checklist items and signoff
areas retain the reference structure. The browser test asserts exactly two A4 pages and
checks the common full agreement number `KC-M-2026-00001`. The internal issue number is
separate from the supplied original agreement number. Actual signoff dates/checks are
never invented. Original issued snapshots remain immutable in the existing private
form ledger with templateVersion3. Old KC-M issuance is rejected both at the standard
API and database guard; other standard forms still use their existing implementation.

### Validation

- Production Next.js build and generated-route TypeScript checks.
- Existing Hatif, draft, navigation, KR API, historical-report DB and direct-management
  DB regressions on isolated/mock data.
- Audit API tests: actor/correlation isolation, safe IP handling, credential exclusion,
  successful/failed password login and global logout, unavailable-provider behavior,
  view gates, offline-export blocking and mutation-wrapper coverage.
- Audit DB tests: RLS, append-only privileges, real diffs, redaction, actor spoof
  rejection, future viewer grant/revocation, native auth and transactional rollback.
- Broker tests: schema constraints, two-page version3 ledger, numbering/retry safety,
  legacy KC-M rejection, other forms and redacted audit.
- Import tests:45-field parsing, amenities, exact/new/conflicting/shared/fuzzy matches,
  explicit clear/zero/false, no property writes during preview, atomic commit, stale
  preview, replay, duplicate targets and all-or-none failure.
- Chromium using the production build and synthetic API/auth fixtures: form/save,
  exactly two-page A4 PDF, real generated template columns, real matcher preview,
  mandatory ambiguity decision, create/update/amenity flow,320/390/768/1440px layouts,
  audit filtering and future Operations Manager grant/revocation.
- Existing workspace and KR browser regression suites with synthetic fixtures.

Browser fixtures validate UI behavior; isolated PGlite validates migrations, functions,
constraints and permissions. These checks do not claim a signed-in production check.

### Future production release boundary

There are exactly three new migration files, ordered audit → broker summary → smart
property upsert. Apply only those files to the inspected live baseline after specific
release approval and a validated private backup. Never rerun the historical migration
folder. A release operator may combine these three transaction bodies into one outer
transaction after removing only their top-level BEGIN/COMMIT wrappers; fail on any SQL
error. Review live schema compatibility, auth.audit_log_entries availability, role
privileges and existing normalized deed/unit duplicates before applying. Existing
duplicates must be resolved explicitly; the migration never deletes or merges records.

Preserve the current Docker environment, network bindings, private attachments, Hatif
secrets and daily22:00 Asia/Riyadh management-report scheduler. Prepare and test a
candidate before switching the live app. Audit proxy trust is a separate verified
configuration decision, not enabled by this source release.

Rolling back the app image alone leaves new additive audit/import structures in place
and legacy KC-M issuance disabled by the new database guard. Use a forward fix for that
path or a reviewed compatibility rollback. Do not drop logs/snapshots or restore an old
database over newer records merely to restore the previous UI. No automatic destructive
down migration is included.
