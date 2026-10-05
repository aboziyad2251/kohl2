# Current checkpoint — 5 October 2026

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
