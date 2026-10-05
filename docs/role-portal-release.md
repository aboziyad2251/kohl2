# Role portals — deployed release, 5 October 2026

Source branch: `origin/codex/role-portals`. The user explicitly approved GitHub publication and production deployment, and both completed on 5 October 2026. Running image: `kohl-portals:20261005`, digest `sha256:679c7fe740115abbdb00ce0a20addc90960c5f720aa4885632504bab4326211a`. Current private backup/override: `/home/debian/backups/kohl-portals-20261005T180024Z/app-image-override.json`. The full production backup was restored successfully into a separate temporary database before migration. Auth settings, passwords and signing keys were preserved. Earlier employee and password backups remain available.

## Delivered behavior

Tenant, owner and broker sessions land on their own Arabic-first responsive portal, with English navigation. Active private Admin/CEO profiles use `/portal-management` and the existing `/users-access` assignments screen. External roles cannot change assignments, account permissions, quotes, commissions or KPIs. Server RPCs verify private profiles and scope every projected record; raw ERP tables remain protected by RLS.

Tenants see assigned contracts, units, rental obligations, linked payments, maintenance histories and private photos. Maintenance follows a server-enforced state machine with quote approval by the responsible tenant/owner and manager approval before scheduling. Owners receive monthly, quarterly and yearly full-property earnings, charts and PDF statements. Brokers see calculated fixed/percentage commissions, closing and payout status, monthly results, a six-month trend and source-derived KPI progress. Executive changes have private before/after audit records.

PDF payment proofs use actual recorded income entries. Arabic branding and verification codes are included; the public verifier discloses only validity, document type and issue time. Private photos are limited to 5 MiB with image signatures validated; scoped downloads use 60-second signed URLs. PDF jobs have a concurrency limit of two.

## Financial assumptions and setup

- The user explicitly chose **full property totals**, regardless of each owner's ownership percentage. The percentage remains assignment data.
- Existing `rent_amount` is annual rent. Generated rental dues use the contract's payment schedule; final partial periods are prorated. Paid/linked historical obligations are preserved when contract terms change. Civil-year proration handles leap years for percentage deal-value commissions.
- Receipt-to-obligation matching is explicit. Existing receipts are not silently matched to dates or units; managers should link them in Portal management. Utility/service bills are separate obligations, not duplicate income transactions.
- Owner deductions include explicitly flagged owner ledger charges and completed owner-borne maintenance. Linked maintenance expenses are counted once. Historical unflagged fees are not assumed to belong to the owner.
- Only managers designate the responsible customer in a quote. Company-borne work skips customer approval. Expired tenant contracts expose history but cannot create requests.
- Missing legacy unit or payment-period information is shown as unrecorded rather than inferred. Custom KPI actuals derive from dated source events.

## Validation

TypeScript and the production image build passed. Existing password/account boundary tests and new calculation tests passed. Transactional database tests cover role spoofing, isolated scope, invalid maintenance transitions, approvals, cancellation, commission types, annual rent schedules, audit, deactivation and retained broker payout metadata. Real isolated Auth/REST/Storage/Next tests passed for two accounts of each external role, including foreign direct-record URLs returning 404, management denial, private photos, payment PDFs and safe verification. Responsive browser checks cover Tenant, Owner, Broker, Admin and CEO in Arabic/English; both Arabic PDFs were rendered and visually reviewed. Fixtures contain fake data only.

## Release and recovery

Staging source: `/home/debian/projects/kohl-portals-release`. Accepted image tag: `kohl-portals:20261005`; `portal-acceptance.json` binds acceptance to the image digest. All QA ports are loopback only. No production accounts or passwords were used in tests.

Deployment asserted the current employee image and prior administrative function, verified a complete database backup by restoring it into a separate temporary database, applied the transactional additive migration, and started only the accepted app image using a preserved Compose override. Unchanged Auth settings/keys, both active executive dashboards and unauthenticated API denial passed. Source files were backed up before copying; Git was not reset. The preserved rollback image can restore the previous app; compatible additive schema should be retained to avoid overwriting live writes.

For future work, inspect and preserve the live deployed edits before Git reconciliation; never run `deploy.sh` blindly. Resume from the portal branch and current image override. Preserve all earlier previews and backups. The cleanup script removes only this release's four test services and exact isolated QA database; PDF samples remain private. Real customer assignment/browser acceptance remains an operator step after deployment.
