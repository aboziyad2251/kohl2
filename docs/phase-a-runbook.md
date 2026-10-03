# External portals: Phase A handover

Phase A implements real Supabase authentication, external account administration, private relationship records, role enforcement, invitations, password recovery, tenant expiry controls and administrative audit history. Tenant maintenance, owner statements/PDFs and broker commission dashboards remain Phases B, C and D.

## Validation on 3 October 2026

- 100 database/PostgREST authorization checks passed using isolated fake records, including two users per role, tenant history, executive CRUD, employee/HR scoping, immutable roles, ownership shares and forbidden direct reads/writes.
- 10 checks passed against the VPS's installed GoTrue version with a local mail catcher: invitation provisioning, verification, password setup, login and disabled public signup.
- 29 checks passed through the actual Next.js endpoints and real Auth sessions: all three external roles, ownership isolation, administrative denial, immediate deactivation, reactivation, password reset, audit entries and invalid input.
- The revocation test exposed Next.js caching of authorization requests. Server Supabase clients now explicitly use uncached fetches.
- The final production build passed compilation, lint/type validation and static page generation.

These tests do not establish complete regression coverage of every existing ERP module. The live schema already differs from the application: financial fields, contract status capitalization, managed property table names and missing archive/installment tables need reconciliation before production cutover. Executive browser caches may contain records absent from PostgreSQL; preserve and reconcile them before replacing the old login system. External sessions never load the ERP data provider or demo records.

## Review preview

Local URL: http://localhost:3102/users-access

Fake administrator: `phase-a-admin@test.invalid`; password: `Kohl-Preview-2026!`.

The preview uses only `kohl_portal_phasea_test_auth2`, separate Auth/REST containers, loopback ports and a local mail catcher. No invitations reach real recipients. `.portal-stage/env.local` contains only preview credentials and is ignored by Git. The SSH tunnel and preview processes must remain running for this URL to work.

## Production prerequisites

1. Confirm the first administrator's email and Saudi mobile number. Do not create external users until a verified executive account exists.
2. Back up production PostgreSQL, storage and application configuration, plus business data stored in existing administrator browsers. Verify restore procedures.
3. Reconcile the schema mismatches and exercise existing ERP workflows with representative records and internal roles.
4. Replace the publicly known default Supabase JWT secret and regenerate anon/service keys consistently across Auth, REST, Realtime, Storage, gateway and every existing client, including the legacy static site. Rebuild Next.js with the new public key. Keep the service key server-only.
5. Configure working SMTP, the real HTTPS site URL and an explicit password-setup redirect allowlist. Disable public signup. The live environment currently has no Auth users, uses the default JWT secret, permits signup and has an unsuitable localhost Auth URL; SMTP needs configuration.
6. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `APP_ORIGIN` in secured deployment configuration. Do not paste secrets into chat. Never enable `NEXT_PUBLIC_PORTAL_PREVIEW` in production.

## Cutover sequence

During a planned maintenance window, apply `supabase/migrations/20261003000256_external_portals_phase_a.sql` through the trusted database connection, using stop-on-error and a transaction. It deliberately removes broad anonymous/authenticated grants and policies on public tables and replaces them with explicit role policies; unknown tables are denied. Review integrations before applying it.

Provision verified internal users with `scripts/bootstrap-portal-users.mjs`, using its validated input JSON and explicit `--confirm` flag. Map HR/Employee accounts to the correct employee rows. The script creates identities without sending mail, writes/audits the trusted mappings, and then issues invitations. Protect and remove the operator input file after provisioning.

Deploy the rebuilt Next.js application using the root `deploy.sh` target (`kohl-vps`, `~/projects/kohl-crm-app`, `docker-compose.next.yml`). Verify login, password setup, executive access, HR/Employee restrictions, all external role boundaries, expiry mode, immediate deactivation and SMTP delivery using designated acceptance accounts. Observe Auth/Next/PostgREST logs for failures without logging passwords or tokens.

Do not restore the insecure anonymous policies as a routine rollback. If cutover fails, keep the application in maintenance mode and restore the verified database/configuration backup under operator control.

## Current deployment state

Phase A was accepted for deployment. Source changes and migration are prepared locally. The implementation and office handoff have been committed and pushed to GitHub. No production migration, production user invitation or application deployment has been performed. The live application remains on its previous revision.

Production preparation on 3 October 2026:

- Private VPS backup: `/home/debian/backups/kohl-phase-a-20261003T074600Z`. Includes PostgreSQL, storage, application and configuration archives. A full restore into `kohl_phasea_backup_restore_check` succeeded using the existing `supabase_admin` database role.
- Staged release: `/home/debian/projects/kohl-phase-a-release`. Docker image built successfully with private pending rotated Auth configuration. Pending files are mode 0600; they have not replaced live settings.
- Password-based trusted internal-user provisioning was added to the operator bootstrap and tested with a fake CEO in the isolated preview database. Supplied real passwords must remain in a temporary protected operator input file, never in source control. Password bootstrap does not send invitation email.
- Two executive bootstrap accounts were approved: Admin/operations manager and CEO. Their contact details and passwords were supplied privately in the working chat and must not be stored in Git. Mobile numbers were confirmed and normalized to the required Saudi local format. SMTP configuration remains pending. No real password or account has been deployed.

Accept Phase A before starting Phase B.
