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
