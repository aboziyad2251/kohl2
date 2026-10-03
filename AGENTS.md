# Project handoff

When the user asks to sync or resume (including "plz sync"), first inspect the checkout and preserve uncommitted work, then fetch GitHub safely. Read `docs/RESUME-FROM-OFFICE.md`, `docs/phase-a-runbook.md` and `docs/google-login-setup.md` for the saved deployment checkpoint.

Latest checkpoint (4 October 2026): Phase A and password-based external account creation are deployed. Resume from `origin/codex/external-account-passwords`, not the older `main` checkpoint, and read `docs/password-account-release.md` with the handoff files. The user confirmed the reset Admin login works. Verify live VPS state before continuing and do not run `deploy.sh` blindly; its hard-reset fallback can discard deployed source edits and its restart can bypass the current image override. Preserve the three deployed edits in the live checkout until reconciled with Git.

Never commit real passwords, service keys, OAuth client secrets, private account input files or raw production catalogs. Authorization roles come from the private database profile, never editable Auth metadata. Only active Admin/CEO accounts may manage users.
