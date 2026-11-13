# Current release — leasing/internal finance deployed, 12 November 2026 (Riyadh)

The user explicitly approved the two reviewed migrations and the tested main-app
image after the server dry run passed. The operator then supplied `RELEASE OK`:
fresh backup archive listing checked, both migrations committed, main switched,
Hatif preserved, broker/account unchanged. This is operator-reported execution,
not a separate direct production inspection from the cloud workspace.

- Continue from `codex/leasing-internal-finance`, PR #2. Dispatcher commit `442ff7d`
  passed local checks and GitHub CI run `43119381385` on Node 20 and 22.
- Running main image reported by the successful exact-image dispatcher:
  `sha256:fc2208da1baee389905f1febd4212a11f69be03f45767ceed3e872272a472506`,
  application source `e3a3eb7e9f3a2b09811d8c7e3d17c705ff68e040`.
- Applied together: `20261110143135_leasing_internal_finance.sql` and
  `20261110215449_operations_private_documents.sql`. Do not reapply them.
- Private release directory:
  `/home/debian/backups/kohl-operations-plan-zgq5zzee/release-20261111T232901Z`
  (12 November, 02:29 Riyadh). Preserve its backup and receipts; never share
  private logs, runtime snapshots or database archives.
- Retain the original main container and its image for rollback. Its restart
  policy was disabled by the dispatcher; explicit recovery restores it. Broker
  and account image IDs remain those in the previous release checkpoint below.
- Successful dispatcher completion means internal/public login and anonymous API
  checks passed. The user subsequently confirmed the release works.

The user confirmed the deployed workspaces work and authorized the next phase:
financial employee → designated manager → designated final approver, plus a
temporary leasing assistant visible only in the designated manager account.
Read `docs/operations-release.md` for recovery; do not repeat apply or historical
release scripts. Application rollback retains the additive schema and new data;
never automatically restore an older database dump. The new phase is in progress
on `codex/leasing-approval-chain`; read `docs/leasing-approval-chain.md`.
The operator supplied verified active ADMIN and CEO account IDs privately; do not
commit them. Local database/browser verification does not authorize production
cutover. On 13 November (Riyadh), the operator reported exact-image approval-chain
HTTP acceptance passed and temporary services were removed. The image ID was not
included in the pasted result. Use the new PREPARE_ONLY tool documented in
`docs/leasing-approval-chain.md` to capture that ID, make a fresh private backup,
rehearse the new migration offline, and preserve the validated Hatif runtime.
Operator then reported successful approval preparation and offline restore with
real records preserved. Accepted candidate image:
`sha256:cc84170de3567a868a6c9605b526744705dc58f469f3055545f2e6e0c5f639a3`.
Private plan: `/home/debian/backups/kohl-approval-plan-k0sdvnsw`.
The new `scripts/release-approval.py` is prepared and tested locally; the next
server step is its default read-only dry run. Read `docs/approval-release.md`.
No new production migration/cutover has occurred. Never reuse the old dispatcher.

---

# Historical preparation — leasing/internal finance, 11 November 2026

Source candidate on `codex/leasing-internal-finance`, based on latest reconciled
`codex/role-portals` including KR audit-noise fix. Read `docs/leasing-internal-finance.md`.
New main-app leasing and internal finance workspaces, private candidate migration,
scoped RPC, tests and persistent Hatif preflight are prepared for review.
No production migration/deployment was performed. User confirmed mixed collection
holders (company/owner/platform) and executive approvals. This is the first functional
slice plus installment schedules, private attachments and accountant ZIP exports.
Term-end alerts now use Riyadh dates with visible 3/7/30-day windows and prefilled follow-ups.
Local build, boundary tests and desktop/mobile browser checks passed; earlier commit a401a74 passed GitHub CI.
Both candidate migrations remain undeployed. Continue from PR #2; the document lists remaining integration and release checks.
Keep the live main/broker/account deployment and Hatif settings intact. Never rerun
historical payout migrations/scripts to ship this candidate.


Server acceptance checkpoint (11 November): operator supplied successful restore
receipt for revised PT409 candidates and exact-image API acceptance for source
`e3a3eb7e9f3a2b09811d8c7e3d17c705ff68e040`, image
`sha256:fc2208da1baee389905f1febd4212a11f69be03f45767ceed3e872272a472506`.
Reviewed-document requests returned 409 in 271/277 ms; accountant ZIP,
employee isolation and deactivation passed with synthetic data. GitHub run
43051486852 also passed. Production remains unchanged.
Next checkpoint (12 November, Riyadh): the operator's preparation succeeded;
latest private plan is `/home/debian/backups/kohl-operations-plan-zgq5zzee`.
The interrupted release dispatcher was recovered from the previous chat and
hardened with a host-wide lock, pinned SQL hashes, repeated Hatif/runtime checks,
atomic migrations, durable attempt receipts and explicit application recovery.
Read `docs/operations-release.md`. Next server step is the read-only dry run in
that document; actual deployment still requires specific release approval.
No production access, migration or cutover was performed in the resumed cloud work.
Application image and candidate SQL remain unchanged. The original app container
and additive schema/data are retained on application rollback; never restore an
older production dump automatically.

---

# Previous release — broker payout requests live, 9 November 2026

Resume from `origin/codex/role-portals`. Read `docs/broker-payout-requests.md` first. The user approved isolated SQL testing, then explicitly approved production migration/deployment after successful tests. The feature is live: brokers request their own full eligible commission and track pending/approved/rejected requests; active Admin/CEO users approve/reject in Portal management → Commissions & payout requests. Approval does not transfer money or mark a commission paid.

- Current main `kohl_crm_app`: `sha256:14c18128ae6221523b4a1804be05f994dc389e7967e13764a47d9e055e14373a` (`kohl-payout-main:20261109`). Current broker frontend: `sha256:b15b68eb3d5127fadc97a2bc8273e1b004ff4073a8202696194912c414dab46f` (`kohl-payout-broker:20261109`). Account frontend remains `sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850`.
- Exactly migration `20261109003906` is now applied. The private request table has RLS/no direct client grants; authenticated JWT-scoped RPC enforces private active roles, own-broker records and server amounts. Live anonymous RPC and API denial passed. There is no generic Supabase migration ledger on this deployment; private release receipts record the applied version/hash. Inspect actual objects/checkpoints and never blindly apply all historical SQL.
- Source/image stage `/home/debian/projects/kohl-payout-release-20261109`; private backup `/home/debian/backups/kohl-payout-20261109T110335Z`. Preserve the old stopped main/broker containers named with suffix `_before_payout_20261109T110335Z`, all current images and the full pre-change PostgreSQL backup. The old source directory remains untouched.
- Validation passed: build/typecheck and 78-route/six-category gate; mocked API checks; PGlite eligibility/ownership/decision tests; native PostgreSQL 17 multi-session duplicate/retry/competing-decision races; exact-image and live fixture browser workflows; grouped navigation/themes/mobile/role regression; exact-image seven-role password suite. Actual banking or a real production commission request was not simulated. Auth container, SMTP/Google settings, runtime environments and proxy configuration were preserved.
- Live TestSprite anonymous payout/API/portal guard passed all six steps, run `5210219b-0834-4768-8705-122f4650bbb5`; dashboard is linked in the release document. Own-password links are now deployed in the main/broker UI as well.
- The local manager/broker review windows use a shared in-memory simulation on `http://127.0.0.1:3123`. They are independent of production. Refresh a live tab to load the new release. Future releases should build from reconciled Git and keep the broker/account asset boundaries; do not use the historical source stages or root `deploy.sh`.

---

# Historical preparation — broker payout requests, 9 November 2026

The user accepted the unified local navigation/pages/broker review, then requested broker commission payout requests with Admin/CEO approval and own-broker visibility. Read `docs/broker-payout-requests.md` for the concrete local draft, SQL proposal and acceptance gaps. This is not a deployed release; the latest published source remains `38ca3ef` and production images remain unchanged.

The draft adds a private request table/RPC proposal, JWT-scoped API, bilingual request/history and executive decision UI. Build, TypeScript, route/category baseline, mocked payout API and existing mocked regression checks passed. The user explicitly approved isolated testing only. The proposed migration and its SQL acceptance passed on disposable PGlite, including broker isolation, role/direct-read/deactivation denial, eligibility, duplicates/replay, rejection/resubmission, stale approvals and no financial mutations. No production migration was run; real PostgreSQL concurrency verification remains pending. Browser acceptance code is prepared but not run: automatic approval review rejected starting the test server because its usage limit prevented review; this was not an action-safety rejection. Resolve that execution block rather than bypassing it.

The received isolated-test permission must not be treated as production migration/deployment approval. Do not push/publish this draft as verified before database/UI acceptance. Existing `scripts/start-local-review.cjs` now prepares an in-memory payout simulation on local port 3122; such a simulation is not SQL/RLS verification. Keep source reconciliation and the current three-frontend deployment boundaries intact.

---

# Latest checkpoint — production source reconciled, 9 November 2026

Resume from `origin/codex/role-portals`. Read `docs/source-reconciliation.md` first. The complete source for the preserved main image has been recovered from the original `kohl-crm-cloud` commit `bab4aaa37d557e06d2d2a4dee1f847f959e944d5` and combined with the broker redesign and verified password recovery updates. The release checkpoint's 359 source blobs matched its recorded GitHub blob hashes without drift. This supersedes the older warning that the GitHub application source lacks the restored navigation/pages.

The reconciled branch passes production build, TypeScript, all 78 live route checks, six navigation categories, the recovered mock/isolated-database suites, responsive workspace/report/audit/import browser suites, seven-role password tests, and the local TestSprite smoke check. `scripts/check-release-baseline.cjs` is now a CI gate; do not remove existing routes or navigation categories silently.

The live site remains on its verified three-container main/broker/account topology described below. This task reconciles source, not a production rollout or migration. The old live directory `/home/debian/projects/kohl-crm-app` remains preserved and must no longer be used as the source of new builds; the clean reconciled source mirror is `/home/debian/projects/kohl-reconciled-20261109`. Read its `SOURCE_COMMIT` before building. Root `deploy.sh` is disabled. Future releases must explicitly choose the target frontend, preserve namespaced proxy routing and verify the exact candidate image before an approved cutover.

Own-password links in the modal and portal remain source-only additions; recovery from login and the separate account frontend are already live and user-verified. Do not infer that this source reconciliation changed the running UI. Historical migration files were recovered as source only, never applied to production. Preserve current credentials, images, rollback checkpoints, real records and private deployed edits.

---

# Previous checkpoint — password recovery live, 9 November 2026

Resume from `origin/codex/role-portals`. Read `docs/password-recovery-release.md` and `docs/navigation-restoration.md` before adding features. This checkpoint supersedes historical SMTP/recovery-disabled notes below.

- Password recovery is enabled for every approved account role using the existing HestiaCP SMTP mailbox on port 587 with verified STARTTLS. SMTP authentication succeeded locally and from the VPS; the user confirmed inbox delivery, then successfully opened a real recovery link, saved a new password and signed in with it. Google/password login remain enabled; public signup, SMS and authenticator MFA remain disabled. No paid provider or migration was introduced.
- Public entry: `/login` → forgot password, or `/auth/forgot-password`. Password setup: `/auth/set-password`. The public `/api/auth/providers` currently returns `google=true, recovery=true`.
- Main application: `kohl_crm_app`, image `sha256:4128d746c87f15ff345a57de78be75b83c0551da0b368f202250484eb8c874d3`. Grouped navigation and newer internal pages are preserved.
- Broker frontend: `kohl_broker_frontend`, image `sha256:223b615202c1e8553c15b60c59d75e3079acd72f28c0f1a256ef4544960a76a6`. Exact `/portal` plus `/__broker_ui/_next/static/` only.
- Account frontend: `kohl_account_frontend`, image `sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850`. Exact recovery/setup/provider routes plus `/__account_ui/_next/static/` only. Both frontends are credential-free and use the internal proxy network `kohl_external_portal`; business APIs stay on the main application. Cross-build navigation uses full document loads.
- SMTP configuration is persisted privately in the existing Supabase Compose `.env`. Auth image, Google settings, signup restrictions and all non-SMTP environment values were preserved and verified. SMTP checkpoint: `/home/debian/backups/kohl-smtp-20261109T000539Z`; proxy checkpoint: `/home/debian/backups/kohl-account-20261109T001123Z`. These private checkpoints contain secrets and must never be copied into Git.
- Validation passed: TypeScript, exact production-image build, synthetic browser checks for seven roles, inactive/unapproved/signed-out guards, invalid recovery links, one-time implicit token initialization and bilingual generic recovery requests. The same synthetic checks passed live. TestSprite public recovery navigation/invalid-link test passed six steps; pinned receipts are in the release document. Real recovery success was confirmed by the user.

## Before the next feature

**This GitHub checkout is older than the restored main image. Do not rebuild/deploy the main application from it or run `deploy.sh`.** The latest read-only VPS inspection still found live source at `1883b16` with 150 dirty/untracked entries. Preserve those deployed edits, all current images, and private overrides. Reconcile the complete source and route manifest before a future main-app build; the retired whole-app broker release path must stay disabled. A GitHub push here publishes the reviewed source delta and handoff, not a reconstructed copy of the complete running main release.

The source changes in ChangePasswordModal and PortalDashboard add direct own-password links but remain **unpublished UI drafts**: neither preserved main nor broker frontend was rebuilt for those links. Login-based recovery and the isolated account pages are fully deployed. Review/test those draft links in the correct frontend before releasing them.

The standard-forms migration/release notes below are historical checkpoints; inspect production state and obtain the required migration approval before any schema changes. For the next feature, first identify whether it belongs in main, broker or account frontend and read its current release document. Keep all SMTP/OAuth credentials, private inputs, real tokens and raw production data out of Git. This publication does not redeploy production or alter accounts.

---

# Previous checkpoint — grouped navigation and broker frontend, 9 November 2026

Read `docs/navigation-restoration.md` first. The user selected restoring the complete previous release, then safely reapplying the broker design. Main `kohl_crm_app` is restored to image `sha256:4128d746c87f15ff345a57de78be75b83c0551da0b368f202250484eb8c874d3` (`kohl-main:nav-restored-20261109`), preserving six grouped categories, search/favorites/mobile navigation and all 32 page-manifest entries. Recovery checkpoint `/home/debian/backups/kohl-nav-restore-20261108T230403Z`.

Broker design is separately served by `kohl_broker_frontend`, image `sha256:223b615202c1e8553c15b60c59d75e3079acd72f28c0f1a256ef4544960a76a6`, only for exact `/portal` and namespaced `/__broker_ui/_next/static/`. No frontend production credentials; isolated internal proxy network. App proxy routing is persisted in host 8's advanced configuration, and only the npm network membership was added to the proxy Compose file after guarded validation. Private proxy checkpoint `/home/debian/backups/kohl-broker-frontend-20261108T231147Z`.

**The source checkout is older than the restored main image. Do not rebuild/deploy the main app from it.** The previous broker build inadvertently omitted newer navigation and pages despite preserving source edits; that whole-app build/deploy path is retired. Preserve the restored image/tag and reconcile complete source before any main-app rebuild. Route-manifest, categories and cross-build portal navigation checks are mandatory. No database/Auth/account change was made in this recovery. Pending local password-reset changes were excluded; SMTP setup is still pending.

---

# Historical deployment — broker portal UI, 8 November 2026

The approved broker portal redesign is live. Read `docs/broker-portal-ui-review.md` and `docs/phone-otp-setup.md`. Current image `kohl-broker-ui:20261108r2`, digest `sha256:6ce1427b87690b85c846fb4961d09cdf51c220b02d332028155240f062626c24`; private rollback checkpoint `/home/debian/backups/kohl-broker-ui-20261107T214206Z`. Source/container backups retain runtime secrets privately. Exact-image isolated browser checks, bilingual/mobile layout, inactive-tab contrast, public pages and anonymous API denial passed. Runtime environment, production networks/ports, database, Auth configuration and real records were preserved.

Important drift: live source/image already contained newer property, CRM, mobile and ivory-surface releases beyond this GitHub branch. This deployment preserved them by building from live source and patching only three broker UI files. GitHub contains the reviewed feature delta; it does not supersede all uncommitted live source. Container labels do not identify a Compose project. Inspect the current container/checkpoint before any restart, preserve live edits and never reset/deploy the entire checkout blindly. SSH worked with the existing `id_ed25519` key and the recorded VPS address; the `kohl-vps` alias was absent on this PC.

Phone OTP: the user subsequently required **free service**. Unifonic SMS is paid, so the earlier provider-signup suggestion is on hold. No SMS was purchased/sent or enabled. Phone Auth is disabled, no SMS provider is configured, Google/password login remain available, and email recovery stays disabled. Authenticator-app TOTP is a possible additional factor without SMS delivery fees, but has not been implemented or selected. Do not claim phone-number SMS login works or enable a paid provider under the current instruction.

---

# Historical office handoff — ten standard forms, 10 October 2026

**Latest deployment: revised KC-M cooperation agreement, 10 October 2026.** Fifteen forms are live, with the eight-page agreement at `/bills-forms/broker-cooperation`. Read `docs/cooperation-form-release.md`. Running image: `kohl-cooperation:20261010`, digest `sha256:d7015bce2ba1dff48849eadf527315147aaffbe68f9fb0b8d379a79b044d1bcf`. Current private backup/override: `/home/debian/backups/kohl-cooperation-20261010T175331Z/app-image-override.json`. Full database backup restore, transactional whitelist extension and final isolated acceptance passed; runtime settings/passwords/keys were unchanged. Resume from `origin/codex/role-portals`, preserve deployed source edits and earlier backups, and use this override for future restarts. Earlier image/override notes below are historical.

**Deployment complete after explicit user approval.** All fourteen forms are live at `/bills-forms`. Resume from `origin/codex/role-portals` and the production-deployment section of `docs/standard-forms-release.md`. Running image: `kohl-standard:20261010`, digest `sha256:487ae988018948dc7c16ea4b9af9109b46f158c208962671a32bbb60597fb095`. Current private backup/override: `/home/debian/backups/kohl-standard-20261010T143747Z/app-image-override.json`. Full database backup restore, transactional migration, unchanged runtime settings and public/protected-route checks passed. Passwords and keys were unchanged. Preserve deployed source edits and use this override for future restarts. The pending/staged notes below are historical. TestSprite remains unavailable on this PC; actual operator issuance is still a user acceptance step.

Checkbox layout work is complete and tested. Final staged image is `sha256:487ae988018948dc7c16ea4b9af9109b46f158c208962671a32bbb60597fb095`; all ten editors, thirteen printed pages and real isolated fourteen-kind issuance tests passed. Read the corrected-release section in `docs/standard-forms-release.md`. Deployment was rejected by automatic approval review pending explicit approval for this exact live migration/image update. Production remains the Bills image below; preserve its override. TestSprite is unavailable on the office PC, so no new TestSprite pass is claimed.

Resume from `origin/codex/role-portals`. The user requested GitHub push and continuation from the office. Source includes the deployed action center/login improvements, existing four-form module and ten new independent forms. Read `docs/standard-forms-release.md` first, alongside the earlier release/runbooks below. Production still has the four-form module; the new extension is not deployed and its production migration is not applied.

Model/type/build checks, ten-form responsive browser tests, thirteen-page A4 print proofs, original four-form browser regressions, real isolated database/Auth/API concurrency/security/rollback tests and the public TestSprite authentication guard passed. User approval for the new migration and publication is already recorded, conditional on passing tests. Before publishing, finish the checkbox/fee-payer visual findings listed in the release document, regenerate SQL if fields change, and rebuild/retest the exact final image in isolation.

Current stage `/home/debian/projects/kohl-standard-release-20261010`; accepted staged image `kohl-standard:20261010`, digest `sha256:84fd2c796afa276b02c80dca0fd2ba88465ab23b6d7d86f429abc8667fbd8b20`. Acceptance applies only to that staged source and SQL. Deployment helper is prepared but unexecuted; review new-file rollback first. Verify fresh live state, preserve office/live edits, and fetch safely without reset. Production credentials/private backups/test proofs are intentionally excluded from Git and must not be reconstructed from placeholders.

---

# Production checkpoint — Bills & Forms installed, 10 October 2026

Bills & Forms is deployed at `https://app.kohlestate-ksa.online/bills-forms`, linked from the internal sidebar for Admin/CEO and employees. Read `docs/bills-forms-release.md`. Final image `kohl-bills:20261010`, digest `sha256:991eb7518c61e225a37bf4055bfc5bd538a8b0b642357ceb0ec8fc0ec3447c9b`; current private backup/Compose override `/home/debian/backups/kohl-bills-20261009T233232Z/app-image-override.json`. Migration `20261009225626` was explicitly approved and applied; the original migration backup is `/home/debian/backups/kohl-bills-20261009T232757Z`. Full backups were restored successfully before deployment. The final image passed real isolated Auth/API/RPC, numbering concurrency/idempotency, role/deactivation, grants/RLS and rollback checks. Three public TestSprite checks passed. No production test document was issued. Runtime settings, Google login, passwords and signing keys were preserved; email recovery remains disabled. QR is a labelled placeholder, not certified ZATCA integration. Preserve live edits and use the latest image override; do not run deploy.sh blindly. This release's source has not been committed/pushed to GitHub.

---
# Current checkpoint — 8 October 2026

Action dashboard and scoped in-app alerts are deployed. Read `docs/action-center-release.md`. Running image is `kohl-attention:20261008`, digest `sha256:fb014dc0d1e8684481465e30998c6477afcab4a35040661373fefc3cf9f2f0c1`. Current private backup/Compose override: `/home/debian/backups/kohl-attention-20261007T231506Z/app-image-override.json` (the UTC timestamp is the previous calendar day in Riyadh). No schema migration was applied. Local/VPS builds, real isolated Auth/API scope and deactivation checks, five-role responsive browser checks and TestSprite bilingual login passed. Public login/recovery pages return 200 and protected APIs return 401 without a session. Google login is enabled and user-confirmed; preserve it and the private Google credentials. The user has no SMTP service; `PASSWORD_RECOVERY_ENABLED=false` must remain until actual email delivery is configured and tested. Preserve live deployed source edits and the image override; never run `deploy.sh` blindly. Local source includes the release changes; GitHub publication has not been performed for this release.

---

Final TestSprite checks passed for local bilingual login and deployed recovery guidance, Google redirect and no public registration. See the pinned run receipts in `docs/action-center-release.md`. Email delivery is the remaining blocked capability because no SMTP service exists; in-app alerts and the action dashboard are live.

# Historical checkpoint — 5 October 2026

Role portals are deployed after explicit user approval. Resume from `origin/codex/role-portals` and read `docs/role-portal-release.md`. Running image: `kohl-portals:20261005`, digest `sha256:679c7fe740115abbdb00ce0a20addc90960c5f720aa4885632504bab4326211a`. Current private backup/override: `/home/debian/backups/kohl-portals-20261005T180024Z/app-image-override.json`. Full backup restore, active executive dashboards and API denial checks passed. Passwords, Auth settings and keys were preserved. The user chose full-property owner earnings. The live checkout retains its old Git HEAD with deployed source edits; preserve them before reconciliation and never run `deploy.sh` blindly. Employee checkpoint details below are historical; use the portal image override for future restarts.

Employee email/password login creation is deployed. Resume from `origin/codex/external-account-passwords` and read `docs/employee-account-release.md` along with the prior release/runbook. This checkpoint supersedes the older notes below.

- Admin and CEO can create employee logins in Users & Access by selecting an active HR employee record and setting an email/password. Add new staff on Employees first. Private EMPLOYEE mappings enforce own-record access and deny user administration.
- User confirmed both executive passwords were changed and work. This release did not reset or use those passwords; saved operator credentials may be stale.
- Running image: `kohl-employees:20261004`, image ID `sha256:1805b6e392eda15847c31ac938ff72df5130e5f9f4f35e7cfd52f0527a55dab9`. Deployment completed 5 October after real isolated acceptance by fake Admin and CEO accounts, including HR record isolation, deactivation and external-role regression checks.
- Current private backup/override: `/home/debian/backups/kohl-employees-20261005T160203Z/app-image-override.json`. Preserve it and all earlier verified backups. Rotated keys and Auth settings are unchanged. Google and SMTP remain unconfigured.
- Live checkout HEAD is still `1883b16` with deployed edits to user API, Users & Access, portal validation/types and the new employee migration. Preserve/compare them before Git reconciliation; never hard-reset or run deploy.sh blindly.
- Read-only live checks passed for both active executive private profiles and employee-management listings, confirmed Auth identities, public login and unauthenticated administration denial. No real employee account was created during tests.
- Remaining acceptance: actual Admin/CEO creation of a real employee and its own-record browser view. Existing preview services remain; this release's fake fixtures and preview container were removed. Future phases require a user request.

---

# Historical checkpoint — 4 October 2026

The user confirmed the reset Admin login works and requested that the work be pushed and saved for future updates. Resume from `origin/codex/external-account-passwords`; source commit `1ec710c` contains password-based Broker/Owner/Tenant account creation. This checkpoint supersedes the historical deployment and pause notes below. Read `docs/password-account-release.md` for release details.

- Live image verified running: `kohl-passwords:20261004`, image ID `sha256:28af0a89d81c6839e96bf92e80da9217012e66daa2da4a180035f5b4c7c8ca11`.
- Active private Admin/CEO profiles can create external accounts with passwords. Actual isolated tests passed for all three external roles, login, restricted access, immediate deactivation and password privacy.
- The user explicitly authorized the Admin password reset. Live Admin password login, private role and user-management access passed; the user then confirmed browser login works. Credentials were delivered in a Windows-user-only file outside the repository and the private VPS operator file was updated. Never commit or display them.
- The CEO identity/profile and database management permission were verified. The CEO password was not reset; successful CEO password login has not been reverified for this release.
- Email/password provider is enabled; public signup remains disabled. Google and SMTP remain unconfigured.
- Current image override and source/configuration backup: `/home/debian/backups/kohl-passwords-20261003T215333Z/app-image-override.json`. Preserve rotated keys and use the current override for later deployments.
- Live checkout `/home/debian/projects/kohl-crm-app` still has Git HEAD `1883b16` plus deployed edits to `app/api/access/users/route.ts`, `app/users-access/page.tsx` and `lib/portal/validation.ts`. These edits are saved in GitHub commit `1ec710c`. Preserve and compare them before reconciling the VPS checkout; do not reset them away or infer the running source solely from HEAD.
- Fake password-test accounts and `kohl-password-preview` were removed. Other existing preview services, preserved original preview containers and verified backup databases remain; inspect them before any cleanup.

On the next update, inspect and preserve local changes, fetch GitHub, read this checkpoint and verify live state. Remaining acceptance: a real external account created by an executive and its assigned-record view, plus CEO browser login/creation. Tenant maintenance, owner statements/PDFs and broker dashboards remain future phases; start only when requested. This save request does not authorize starting a new phase.

---

# Historical deployment checkpoint — 3 October 2026

**Paused at the user's request after successful deployment. Resume only when the user says "plz sync" at home.** Fetch `origin/codex/phase-a-production-cutover` (not just `origin/main`), preserve local work, and read this latest section before the historical notes below. The release and handoff are pushed on that branch; production runs app commit `1883b16`.

Remaining at pause: user acceptance in the actual browser; optional broader live read checks; cleanup of this run's loopback-only `kohl-cutover-preview-app`, `kohl-cutover-preview-auth`, `kohl-cutover-preview-rest` and `/home/debian/backups/kohl-cutover-20261003T144142Z/preview.py` process. The last combined extra-read/cleanup command was not executed because automatic approval review encountered a usage limit. Earlier public HTTPS, executive login, role, record-count, key-rejection and service-health checks all completed successfully. Keep the verified backup databases/files. Do not confuse these test services with production or older preview services.

The office login file is `C:\Users\moham\Downloads\Kohl-executive-login-private.txt` and is restricted to that Windows user; it is not in Git. At home, retrieve credentials securely from the existing private VPS account file if needed. Preserve the unrelated local `scripts/update_msix_claude.py`; it was intentionally excluded from the deployment branch.

Phase A is deployed at https://app.kohlestate-ksa.online. Both approved executive password logins were verified against the live HTTPS application. Google login remains disabled; SMTP delivery is still unconfigured.

- Tested/deployed application source: `1883b16`, branch `codex/phase-a-production-cutover` (pushed to GitHub).
- Verified running image: `sha256:192b426366f0582420f1f625dad3753bd880117be87b92f33a6a6d806ff7cbe3`, tagged `kohl-phase-a:verified-20261003`.
- Live checkout `/home/debian/projects/kohl-crm-app`, container `kohl_crm_app`, loopback port 3020.
- Current private backup `/home/debian/backups/kohl-cutover-20261003T144142Z`: initial full restore verified, final `postgres-at-freeze.dump` restored into `kohl_cutover_final_restore_20261003`, private browser export preserved. Never commit these files.
- Compatibility migration was applied BEFORE Phase A in one transaction. Forty-five write payloads passed structural checks; 21 real ERP/security checks and 29 full Next/Auth/REST checks passed in isolation. The exact executive provisioning procedure also passed for fake Admin/CEO accounts before production use.
- Production has 4 lessors, 6 ownership documents, 6 properties and 6 brokerage agreements. The latter two collections were recovered from the browser. No browser deletion markers were replayed. Sample HR/CRM/maintenance/report records remain in the private backup, not production.
- Both approved real executives exist in Auth and `portal_private.accounts`; password login, private role, executive administration and record visibility were verified. Credentials remain in `/home/debian/.config/kohl/executive-accounts.json`; a current-user-only local login file was delivered outside the repository. Never display passwords in logs or commits.
- Signing keys rotated consistently across Supabase, database settings, app and legacy static key references. All production Supabase healthchecks passed. Old keys and anonymous record access return HTTP 401; unauthenticated application administration returns 401. Public/anonymous/phone signup is disabled.
- The legacy static ERP now redirects to the secure app login; its original source/configuration is backed up. n8n had no Supabase credential entries.
- The deployed app reads authorized database records instead of merging old browser caches, preventing sample records from reappearing.

## Follow-up

Verify user acceptance in the actual browser. Configure genuine Google OAuth and working SMTP separately; password login is available now. Continue to require an active private Admin/CEO profile for user management. Phases B/C/D remain outside this release.

Do not rerun the one-shot cutover or root deploy script blindly. Inspect live state first. The private image override lives at `/home/debian/backups/kohl-cutover-20261003T144142Z/app-image-override.json`; rebuilding must retain the rotated public key and server-only service key.

---

## Historical pre-deployment handoff

# Resume from the office

Checkpoint: 3 October 2026, Asia/Riyadh. The user paused before production cutover and requested this GitHub handoff. Resume when the user says **"plz sync"**.

## First actions after "plz sync"

1. Inspect the current checkout, branch and uncommitted changes. Fetch GitHub `aboziyad2251/kohl2`; fast-forward only when safe. Preserve office changes.
2. Read this file, `docs/phase-a-runbook.md` and `docs/google-login-setup.md`.
3. Verify current VPS state before relying on the checkpoint below. Do not run the root `deploy.sh` blindly: it includes a hard-reset fallback and would bypass the remaining Auth cutover work.
4. Continue the already requested production deployment to `https://app.kohlestate-ksa.online`. Keep Google login disabled until genuine OAuth credentials are configured and tested.

## Completed work

Phase A source implements real Supabase login, external role/account administration, private link records, RLS, immediate deactivation, invitations, password recovery and audit history. User management requires an active Admin or CEO, checked by both server endpoints and the database. External sessions do not load internal ERP data. Public signup must remain disabled.

The user approved the implementation and requested two initial password-login executive accounts. Their names/contact details/passwords are intentionally excluded from Git; retrieve them from the authorized working chat or obtain them securely from the user. Their roles are Admin/operations manager and CEO. Saudi mobile numbers were confirmed; do not invent replacements.

Validation: 100 database/API checks, 10 real Auth/invitation checks and 29 full Next/Auth/REST checks passed on isolated records. Password bootstrap and its verified CEO login were also tested. The staged Docker builds passed after Google UI/callback and approved-account creation changes. Actual Google OAuth has not been tested because credentials are missing.

## VPS checkpoint — verify before continuing

- SSH alias: `kohl-vps`; home: `/home/debian`.
- Live app checkout: `/home/debian/projects/kohl-crm-app`, container `kohl_crm_app`, host loopback port 3020. Live app was still the old revision at pause.
- Staged source/image: `/home/debian/projects/kohl-phase-a-release`; image `kohl_phase_a_release-kohl_crm_app`. Built successfully; do not confuse staging with deployment.
- Private backup: `/home/debian/backups/kohl-phase-a-20261003T074600Z`. Includes PostgreSQL, application/config and storage archives. A full restore into `kohl_phasea_backup_restore_check` passed using existing `supabase_admin` (postgres is not a superuser).
- Private `supabase.env.pending` and `app.env.pending` in the backup directory contain generated replacement JWT/anon/service keys. Never print them, copy them into Git or regenerate inconsistently.
- Supabase Compose: `/home/debian/supabase/docker/docker-compose.yml`. Gateway container `supabase-envoy`, internal alias `envoy:8000` on `supabase_default`.
- Pending Auth configuration has the real HTTPS site/API URLs, exact password and Google callback redirects, signup disabled and anonymous/phone signup disabled. It has **not** replaced live configuration.
- No production migration or real executive Auth account was created. No production credentials were changed. SMTP was still unreachable with placeholders; Google OAuth credentials were absent.
- Isolated preview DB: `kohl_portal_phasea_test_auth2`, with fake Auth/REST/mail-catcher services. Other test/restore DBs are disposable verification environments, not production. Never confuse them with `postgres`.

## Google setup steps for the user

1. Open https://console.cloud.google.com/ and create/select a project.
2. Configure OAuth consent: **Kohl Real Estate**, External audience, support email. During testing, add the approved Google-account emails as test users.
3. Create an **OAuth client ID → Web application**.
4. Authorized JavaScript origin: `https://app.kohlestate-ksa.online`.
5. Authorized redirect URI: `https://kohl.kohlestate-ksa.online/auth/v1/callback`.
6. Download the client JSON and store it privately outside the repository, for example `/home/debian/.config/kohl/google-oauth.json` with mode 0600. Tell the agent only its path; do not paste secrets into chat.

Configure the provider as described in `google-login-setup.md`. The application callback is `/auth/callback`; the Google Cloud redirect goes to the **Supabase** callback above. Verify identity linking preserves existing approved account IDs. Test approved and unapproved Google users, role isolation and deactivation before enabling the button. Do not enable public signup as a workaround.

## Remaining cutover work

Refresh and verify backups if production data changed. Reconcile existing ERP/schema differences listed in the runbook and verify critical internal workflows. Coordinate signing-key rotation across all Supabase services and existing integrations, apply the Phase A migration to the production database, bootstrap the two approved executives through trusted server administration, deploy the built image to the existing app target, and verify both real password logins and executive-only user creation. Keep real credentials out of command output and source files.

Google activation requires the user-owned OAuth client. SMTP is still needed for emailed recovery/invitations; once Google is genuinely enabled, approved Google account creation does not require invitation email. Report these limits accurately.

Phases B/C/D (tenant maintenance, owner statements/PDFs and broker dashboards) are not implemented. Do not start them before Phase A acceptance.
## Ten standard forms extension — 10 October 2026

See the latest office handoff at the top and `docs/standard-forms-release.md`. Browser/print and real isolated SQL acceptance subsequently passed after the user's conditional approval. Migration `20261009235815` remains unapplied to production, and the extension is not deployed. Complete the documented visual corrections and exact final-image verification from the office.
