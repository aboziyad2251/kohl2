# Production resume check — 3 October 2026

Read-only VPS verification after syncing GitHub to `17f7ece`.

- Live checkout remains `85dd459`; `kohl_crm_app` is running the old application.
- Staged release directory exists. Its image/configuration has not been activated.
- Production `auth.users` contains zero users. `portal_private` is absent: Phase A migration has not been applied.
- Auth is healthy, but still uses the default JWT secret, allows public signup, and lacks the application redirect allowlist.
- An SMTP host is configured, but the referenced mail container is absent. This does not establish working email delivery.
- Saved backup and pending private configuration files remain present. Their contents were not printed. Fresh backup/restore verification is still required before cutover.

## Compatibility findings

The live financial ledger uses `amount`, `net_profit`, `tax_vat`, and income/expense transaction types. The application expects `flow_type`, `gross_amount`, `tax_vat_amount`, `net_amount`, linked entity IDs, and business transaction categories. The old financial migration uses `CREATE TABLE IF NOT EXISTS`, so it cannot reconcile this existing table; it also contains mock seed records and must not be run blindly.

The live database has `managed_properties`, while executive writes target `managed_property_contracts`. Their field layouts differ. Maintenance writes similarly expect fields absent from the live maintenance table. `archived_documents` is missing. The old archive migration creates unrestricted policies and must not be applied as the final access configuration.

Live contract status constraints accept lowercase English values and Arabic values. Application status normalization must be verified before production writes.

## Required before cutover

1. Executive input is now prepared in `/home/debian/.config/kohl/executive-accounts.json`, with mode 0600 and independently generated temporary passwords. Approved identity details were supplied by the user. No production Auth identities have been created; passwords were not displayed or added to Git.
2. Preserve executive browser-only records and reconcile them with PostgreSQL before replacing the legacy login.
3. Prepare and validate schema/data compatibility changes against an isolated production restore; verify representative internal workflows.
4. Refresh and verify private backups; verify all clients/integrations for coordinated signing-key rotation.
5. Apply the coordinated Auth/database/application cutover and bootstrap the approved accounts; verify real logins and role boundaries.

Google login remains disabled until genuine OAuth credentials and acceptance tests are available. Email recovery/invitations remain pending working SMTP verification. No production mutations were performed during this resume check.

## Expanded write compatibility check

`scripts/check-erp-compatibility.py` inspected 45 direct object write payloads against production column metadata. It reports 15 structural differences (some operations share the same underlying issue). It exits with failure until these differences are resolved, and does not claim to validate value constraints or workflow behavior.

Additional confirmed mismatches: property writes use `title` while production requires `property_name`; customer orders use `client_name`/`client_phone` while production requires `customer_name`/`customer_phone`; general services use `title`, `cost_amount`, `fee_amount`, and `office_profit` while production requires `service_name`; contracts lack the collection/profit/security-deposit/lessor-requirements/consent fields expected by the app; ownership audit writes expect previous/new lessor and representative IDs absent from the live table.

Production cutover remains blocked on browser-data preservation/reconciliation and isolated verification of compatibility changes. The protected input file alone does not make the staged release ready for production.

## Browser backup received and compared

On 3 October 2026, verified a private browser JSON export from the production app origin in the operator's Downloads directory. All 28 entries parse successfully. Keep the raw backup outside Git.

`scripts/reconcile-browser-backup.py` performed a read-only comparison against production:

- Four lessors and six ownership documents share IDs and matching common fields with production.
- Six properties and six brokerage agreements exist only in the browser backup. None of their IDs match the verified live revision's seed definitions. They require validated import after schema reconciliation.
- Several other browser-only records match legacy seed IDs: HR, payroll, CRM, maintenance, audit and report records. ID matches alone do not establish that those records are unchanged sample data; compare values before excluding or importing them.
- There are 47 browser deletion markers. None matches current rows in the compared production tables. Preserve the markers; do not replay deletes automatically.
- The live compatibility checker still reports 15 structural differences. No production writes, imports or deployment were performed.

Next: resolve app/schema mismatches, validate the browser import and relationships on an isolated production restore, then finish the coordinated cutover checklist above.
