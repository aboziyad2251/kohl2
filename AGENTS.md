# Project handoff

When the user asks to sync or resume (including "plz sync"), first inspect the checkout and preserve uncommitted work, then fetch GitHub safely. Read `docs/RESUME-FROM-OFFICE.md`, `docs/phase-a-runbook.md` and `docs/google-login-setup.md` for the saved deployment checkpoint.

Production cutover was paused by the user. A staged image is not a deployed application. Verify live VPS state before continuing and do not run `deploy.sh` blindly; its hard-reset fallback and immediate restart bypass the coordinated Auth cutover.

Never commit real passwords, service keys, OAuth client secrets, private account input files or raw production catalogs. Authorization roles come from the private database profile, never editable Auth metadata. Only active Admin/CEO accounts may manage users.
