# Sales and rental matching

Two staff workspaces `/sales` and `/rental-market` share existing property IDs and
customer order IDs. Existing `/leasing` booking/approval workflows remain intact.
Navigation uses the existing CRM permission. ADMIN, CEO and active EMPLOYEE accounts
can use matching; HR/external/inactive/delegated specialist accounts cannot. This
change does not broaden the specialist token scope or alter financial approvals.
The old CRM type-only matcher is replaced with links to the explained matcher.

Existing requests need explicit SALE/RENT classification. Staff maintain marketing
profiles attached to their existing customer order, rather than creating duplicate
customers. Existing property/map classifications and unspecified legacy prices are
not silently copied. Each property can have an independent sale and rental listing.
For rental, the listing must link to an exact existing leasing unit of that property.
Several units in the same property can have separate rental offers without
duplicating the property. Existing offers can be edited by their immutable IDs.

Request and listing editors record city, district, kind, rooms, entrances, area,
explicit price/budget and rental pricing cycle. Arabic descriptions offer editable
room/entrance suggestions only. Unknown prose is not treated as structured evidence.
Staff choose required constraints. Unknown listing values never satisfy a required
constraint. Remaining preferences use fixed transparent weights: budget30, city20,
district15, kind15, rooms10, entrances5, area5, normalized to entered criteria.
Sale results disclose linked currently active rental contracts; no active contract
in the database is never described as proof of vacant possession.
City/kind/district use normalized exact text, not geographic distance or an LLM.
Scores indicate preference fit, not sale probability. Soft mismatches are explained.

Rental results require matching price cycles and an available unit from the existing
availability RPC for the exact request dates. Missing availability, occupied units,
missing mappings or unavailable services cannot produce eligible rental suggestions.
Availability is a snapshot, not a reservation. Existing booking paths retain their
server-side conflict checks. Reverse matching evaluates configured active customer
orders for the selected property. Closed source requests are excluded. Over 50 unique
rental periods in reverse search requires narrowing to a single request.

Messages are editable drafts for manual copying; nothing is sent automatically and
copying is not recorded as contact. Feedback records CONTACTED/VIEWING/OFFER/WON/
REJECTED with actor and timestamp; rejection requires a reason. WON is a marketing
outcome, not an approved financial transaction or a confirmed contract. Event IDs
support retry without duplicate entries. Reports show distinct request/property
pairs per historical stage, not an invented conversion probability. Feedback is
visible for analysis but does not automatically retrain or change ranking weights.

The new private tables are RLS-enabled with no direct client/service grants. The
single public RPC has a fixed empty search_path and verifies active private account
roles; actor identity comes from auth.uid(), never a client payload. The API uses
the caller's JWT and strict payload schemas, with the existing audit wrapper for
writes. LOAD deliberately includes the office-wide property/customer-order catalog,
as permitted to these office roles, but excludes phone, identity, HR and finance
fields. Initial catalog limit is 2,000 properties/orders, rejected rather than
silently truncated. No automatic messages, backfill, contract or financial mutation. Deleting an existing
property or customer order through its existing authorized workflow cascades its
marketing metadata so the new foreign keys do not block legacy deletion workflows.

## Verification and deployment

Local checks: algorithm boundary tests, API role/payload/error tests, real SQL in
PGlite (grants/RLS, inactive/specialist denial, validation, linkage and retry),
mobile Chromium component acceptance with synthetic API data, TypeScript/build,
legacy navigation/route preservation, recovery-disabled and Hatif regression tests.
These are not live production or authenticated exact-image deployment acceptance.
TestSprite CLI is unavailable; these use repository test harnesses.

Run `scripts/preflight-market-matching.py` on the VPS first. It is read-only, checks
the last deployed availability image, Hatif, disabled account recovery, DB image,
required schema and migration absence. Do not rerun a historical release dispatcher.
After passing preflight, preparation must build a pinned image, test the real HTTP
flow, take and restore a fresh private backup, rehearse the additive migration and
provide a reviewed dispatcher. No production matching migration/deployment has yet
been performed. Never share runtime JSON, raw logs, backups or secrets.

To enable TestSprite separately, install its CLI and run `testsprite setup`.
