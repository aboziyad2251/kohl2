# Password creation release — 4 October 2026

The deployed `kohl-passwords:20261004` image lets active private Admin/CEO profiles create Broker, Owner and Tenant accounts with a password of 12–128 characters. Use `/users-access`, Create user, select the role and links, enter a password and save. Share the password privately. Passwords are passed only to Supabase Auth, never profile RPCs, audit payloads, API responses or WhatsApp text. Editing account links cannot change a password.

Both live executive Auth identities are confirmed and private profiles are active. Database user-management LIST permission was verified for both. Unauthenticated access returns 401. Saved operator-file passwords currently return `invalid_credentials`; successful live executive password login was not verified in this release. Do not reset these passwords without the user's instruction.

Supabase had `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`, which rejected password login with `email_provider_disabled`. `ENABLE_EMAIL_SIGNUP=true` now enables that provider, while `DISABLE_SIGNUP=true` continues to disable public signup. Google remains disabled and SMTP remains unconfigured. Password-created accounts need no invitation email.

Local TypeScript, production build and route boundary tests passed. The staged VPS production build passed. Real isolated Auth/Next tests passed for creation, password login, private role, administration denial, immediate deactivation and audit privacy for all three roles. No real external accounts were created for testing.

Private deployment backup and current Compose image override: `/home/debian/backups/kohl-passwords-20261003T215333Z`. The UTC timestamp reflects the VPS clock; the client date is 4 October. Previous image and source/configuration are preserved there. Deploy from the current override rather than the historical Phase A image override; never run the root deploy script blindly. No migration or signing-key rotation was performed.

The existing isolated preview Auth/REST services had stale database IPs. They were recreated against the current DB IP; original containers remain as `kohl-cutover-preview-auth-password-backup` and `kohl-cutover-preview-rest-password-backup`. The disposable password preview uses loopback port 39041. It can be removed after testing. Operational scripts assert the isolated database before any fixture writes; the live access checker performs only reads.
