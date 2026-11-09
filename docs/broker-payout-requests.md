# Broker commission payout requests — live, 9 November 2026

## Reviewable behavior

- Brokers request the full recorded commission on an assigned contract whose closing timestamp has passed and whose payout is not already marked paid. The server calculates the amount from the agreement/override and existing contract-value formula. No submitted amount, actor or broker ID is accepted.
- Requests are `pending`, `approved` or `rejected`. Rejection requires a reason and permits a new request. A partial unique index prevents another pending/approved request for the same broker/contract. Client retries reuse a UUID; database replays return the existing own request without duplicating history.
- Active ADMIN/CEO users review all requests under Portal management → Commissions & payout requests. They can approve/reject only pending requests. Approval rechecks commission eligibility and the calculated amount. Changed amounts require rejection and a fresh request. Decisions and submission notes remain in the request history.
- Approval records a decision only. It does not execute a bank transfer, mark the commission paid, alter commissions or create accounting entries. Existing administrative payment recording remains separate.
- Brokers see only their own requests, including historical requests after unassignment. The list refreshes on visibility, every 15 seconds and manually; it has status filtering and 50-row pagination. Other external roles and staff cannot access it.

## Approved database change

CLI-created migration: `supabase/migrations/20261109003906_broker_payout_requests.sql`.

It adds one private table `portal_private.broker_payout_requests` with request/owner/contract IDs, contract-number and amount snapshots, status, notes, timestamps, decision actor and an append-only history through the RPC. Foreign keys preserve referenced accounts/contracts while requests exist. Three indexes cover active-request uniqueness and owner/status listing.

RLS is enabled with no direct client policies or table grants: anonymous/authenticated clients cannot directly read or change the table. A single `public.broker_payout_requests(operation,payload)` SECURITY DEFINER RPC uses a fixed empty search path, takes identity only from `auth.uid()` and checks the active private account role on every operation. Only authenticated callers have execution permission. Broker LIST filters both rows and counts to their own ID; SUBMIT derives ownership from the caller. DECIDE permits only active ADMIN/CEO. Unknown JSON keys are rejected inside SQL as well as at the API boundary. There are no user-metadata role decisions or supplied service-role actors.

Commission-link locking serializes submissions/decisions; request row locking and state checks prevent two decisions. The calculated amount is read under contract/agreement locks. The feature uses a caller-authenticated Supabase client rather than a privileged service client. No existing function, policy or business record is rewritten by the migration.

Read-only production readiness inspection confirmed the proposed table/RPC are absent and the expected commission columns/value function exist. The user subsequently explicitly approved isolated testing only. This migration was executed successfully on a disposable PGlite database and nowhere else. The user later explicitly approved production migration and deployment after successful tests. That cutover is complete; no other migration was applied.

## Source and acceptance

- UI: `components/portal/PayoutRequests.tsx`, embedded in the existing BrokerPanel for brokers and executive review. Current broker design and main navigation are retained.
- API: `/api/portal/payout-requests`, with strict Zod inputs, private role checks, caller JWT RPC and generic conflict/error responses; POST uses the existing audit wrapper.
- Passed: production build, TypeScript, the 78-route/six-category baseline gate, mocked payout API role/spoof/reason/pagination/error checks, and existing mocked navigation/Hatif/drafts/audit suites.
- **Passed after explicit isolated-test approval**: `tests/payout-requests-db.cjs`. It applied the proposed migration only to a disposable PGlite fixture and verified owner isolation, role/deactivation/anonymous/raw-read denial, server-calculated amounts, paid/unclosed/future-closing/zero-amount exclusion, duplicates/replays, rejection/resubmission, stale approval, immutable decisions/history and absence of financial mutations. Native PostgreSQL concurrency and actual deployed grants were subsequently verified as detailed below.
- **Passed locally, on both exact candidate images and live with mocked APIs**: `tests/payout-requests-browser.cjs`, with shared in-memory request fixtures for submit → reject → resubmit → approve, two broker contexts, reason enforcement, refresh, bilingual/mobile checks. These fixtures cannot prove SQL/RLS enforcement.
- `scripts/start-local-review.cjs` is prepared to show a manager approval window and broker request window using the shared simulation; no real database or email is involved. Other writes remain blocked. Use `scripts/payout-review-fixture.cjs` only for local review/tests; application code never imports it.
- The initial automatic-approval usage-limit block cleared. Browser acceptance then found an ambiguous accessible label on a select; explicit accessible names fixed it. The rebuilt images passed the workflow. One packaged recovery test timed out during a concurrent suite; the individual invalid-link cases and complete serial seven-role suite subsequently passed without changing Auth code.

## Native PostgreSQL acceptance

`scripts/test-payout-postgres.py` passed on PostgreSQL 17.11, matching the production major version (17). Image digest: `sha256:3540c0362c809df084ffac0ae69fe794515f9de92692f02178bcdce0ef0302ac`. The container had no network, ports, production credentials or bind mounts and used disposable tmpfs storage. It was removed after acceptance.

The test proved two distinct backend sessions were simultaneously waiting on the commission lock, then verified different-ID duplicate submissions produce exactly one request, same-ID retries produce one history entry, and competing Admin/CEO decisions produce one decision and a conflict. It also checked broker row/count isolation, raw-table/decision denial, stale-amount approval rejection and absence of financial mutations. These are real SQL/role/claim checks, not a signed GoTrue JWT end-to-end test. Browser tests use synthetic Auth/API fixtures separately; no real payout request was created by automation.

TestSprite anonymous guard passed locally (run `3fc51b3a-107f-4601-92d6-678a781c917b`, six steps); public post-cutover verification also passed all six steps (run `5210219b-0834-4768-8705-122f4650bbb5`). Test `9f80d647-080c-4499-b95e-31e9451cada6`. [Dashboard](https://www.testsprite.com/dashboard-v3/o/262d11f4-a3ed-5e4f-acd5-0bc69ada0f6a/projects/7930d491-00e4-4183-a083-9d1607d945f9/test-cases/9f80d647-080c-4499-b95e-31e9451cada6).

## Production cutover

- User explicitly approved publishing after successful tests; both candidate images passed baseline and synthetic browser acceptance. All 273 application/build-input files matched the reviewed source; the migrated SQL matched the native PostgreSQL test input byte for byte.
- Main: `kohl-payout-main:20261109`, image `sha256:14c18128ae6221523b4a1804be05f994dc389e7967e13764a47d9e055e14373a`.
- Broker: `kohl-payout-broker:20261109`, image `sha256:b15b68eb3d5127fadc97a2bc8273e1b004ff4073a8202696194912c414dab46f`.
- Account frontend remains `sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850`. All runtime environment values, Auth container identity and exact NPM proxy configuration were preserved and checked.
- Only migration `20261109003906_broker_payout_requests.sql` was applied, atomically. The deployment has no Supabase migration-ledger table; the version, SQL hash and security checks are recorded privately in the release checkpoint. Never run all historical migrations or `supabase db push` blindly.
- Private checkpoint: `/home/debian/backups/kohl-payout-20261109T110335Z`. It includes the full pre-change compressed PostgreSQL backup and original container configurations. `pg_restore --list` validated archive readability; this release did not perform a full restore rehearsal. Never put these private files in Git.
- Source stage: `/home/debian/projects/kohl-payout-release-20261109`. Source archive SHA-256: `642fe44720c8a4f66a4972b993c717a93f7357c07e87df4069f13a524eb4fa22`. `source/` is the immutable functional build input; latest operator docs/tests can be newer in Git.
- Security verification: RLS enabled, authenticated raw table SELECT denied, anonymous RPC execution denied, authenticated RPC execution granted. The real public PostgREST endpoint rejected anonymous LIST with SQLSTATE 42501, confirming the schema cache sees the new function. Public main/API/assets/provider/recovery checks passed; live fixture browser checks preserved grouped navigation and exercised payout UI without production writes. Request count at cutover was zero.

## Rollback and future releases

Previous stopped containers are `kohl_crm_app_before_payout_20261109T110335Z` and `kohl_broker_frontend_before_payout_20261109T110335Z`. Preserve them and their images. The guarded helper can restore the old containers if cutover checks fail. Keep the additive request table/history when rolling back application images so genuine submitted requests are not lost; do not drop the table or bulk-change commissions. A schema correction needs a separately reviewed migration.

Future main and broker builds must use the reconciled Git source, preserve all 78 baseline routes and namespaced broker/account boundaries, and verify the exact images. The old hardcoded broker source stages and root `deploy.sh` remain retired. CI now runs mocked payout/API tests, disposable PGlite acceptance, and the pinned PostgreSQL concurrency test on the Node 22 job. Existing account recovery, Google login, private profiles, commissions and financial records were preserved. The own-password links previously kept as source drafts are now included in the deployed main/broker images.
