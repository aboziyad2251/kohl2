# Leasing/internal-finance release procedure

Prepared 12 November 2026 (Riyadh). This procedure has not deployed production.
The operator's last successful preparation used
`/home/debian/backups/kohl-operations-plan-zgq5zzee`.
The current main, broker and account containers must still match that private plan;
the dispatcher stops if any runtime or Hatif setting changed.

## Reviewed scope

- Main application source: `e3a3eb7e9f3a2b09811d8c7e3d17c705ff68e040`.
- Exact accepted image: `sha256:fc2208da1baee389905f1febd4212a11f69be03f45767ceed3e872272a472506`.
- Only `20261110143135_leasing_internal_finance.sql` and
  `20261110215449_operations_private_documents.sql`, with their reviewed SHA-256
  hashes pinned in the dispatcher. Application source and SQL are unchanged by
  this release-tooling update; no candidate rebuild is needed.
- Existing main image retained for rollback:
  `sha256:14c18128ae6221523b4a1804be05f994dc389e7967e13764a47d9e055e14373a`.
- Preserve broker/account containers, production Hatif environment, ports,
  networks, Auth configuration and all existing records. KR operations summary
  remains at its existing setting; this procedure does not enable it.

The operator previously reported successful real-backup restoration, exact-image
Auth/REST/Storage application acceptance, and preparation. These are recorded
receipts from 11 November, not fresh observations from this cloud workspace.

## Next server action: read-only dry run

Run from the operator's existing VPS terminal:

```bash
(
set -eu
cd /home/debian/projects/kohl-operations-review-20261111
git pull --ff-only origin codex/leasing-internal-finance
python3 -B scripts/release-operations.py \
  --plan /home/debian/backups/kohl-operations-plan-zgq5zzee
)
```

Without `--apply` or `--rollback`, this only validates the saved plan, exact image,
SQL hashes, all three live runtime snapshots, the persistent Hatif file, absence
of the new database objects, and Nginx configuration. It does not back up, migrate,
stop, create or replace containers. Share only the short result, never runtime JSON,
backup data or private logs. A rejected plan requires inspection, not deletion of
receipts or blind retry. A new preparation is appropriate only after explaining
and reviewing any changed runtime.

## Apply after specific release approval

The dry run must pass and the user must approve these two additive migrations and
this exact main image. A command-line image argument records the operator's intent;
it does not itself establish user approval. Coordinate the short main-app restart.

```bash
python3 -B scripts/release-operations.py \
  --plan /home/debian/backups/kohl-operations-plan-zgq5zzee \
  --apply \
  --approved-image sha256:fc2208da1baee389905f1febd4212a11f69be03f45767ceed3e872272a472506
```

The dispatcher:

1. Holds one host-wide operations release lock across validation, migration,
   cutover and rollback, even when multiple preparation directories exist.
2. Writes a durable attempt receipt and a private release directory. A plan can
   be attempted only once; interruption requires receipt inspection.
3. Takes a fresh custom-format PostgreSQL backup and checks its archive listing.
   Listing is not a full restore test. The earlier restore rehearsal remains the
   evidence for restorability; Storage object files are not included in this dump.
4. Rechecks runtime/Hatif settings after backup, then applies exactly both pinned
   migrations in one transaction, with advisory/statement/lock bounds. A failed
   or interrupted client may leave the commit outcome unknown: inspect the private
   `migration.json` and actual schema before deciding recovery. Never reapply blindly.
5. Rechecks runtime/Hatif again before stopping the main container. Retains the
   original container under a unique name with restart disabled so it cannot compete
   for ports after a Docker reboot, creates the replacement from the saved
   runtime, and verifies image, environment, ports and network aliases.
6. Checks internal login/API responses, validates and reloads Nginx, checks public
   login/API responses, and verifies the broker/account IDs and images are unchanged.
   It saves a `live` receipt only after these checks succeed.
7. On cutover failure, restores the original main container and checks its login
   internally and publicly, restoring its original restart policy. It retains the additive schema and any new data. It
   never automatically restores an older database dump.

Ordinary interruptions during cutover trigger rollback. Power loss, SIGKILL,
Docker unavailability or failed rollback require the recovery command below after
inspection. If migration committed but cutover never began, the original app is
still running; inspect before preparing any new release.

## Explicit application recovery

Use the exact private release directory printed by the failed/successful apply.
Do not invent a timestamp. After reviewing its receipts, set this shell variable
locally (the path contains no credentials):

```bash
# Replace with the directory from the apply output before running.
KOHL_OPERATIONS_RELEASE_DIR=/home/debian/backups/kohl-operations-plan-zgq5zzee/release-YYYYMMDDTHHMMSSZ
python3 -B scripts/release-operations.py \
  --plan /home/debian/backups/kohl-operations-plan-zgq5zzee \
  --rollback "$KOHL_OPERATIONS_RELEASE_DIR" \
  --approved-image sha256:14c18128ae6221523b4a1804be05f994dc389e7967e13764a47d9e055e14373a
```

Recovery validates the plan/attempt/cutover relationship and saved original runtime
before removing a replacement. It removes only this release's labelled candidate
image, refuses unrelated containers, restores the original name and running state,
then verifies public login and preserved frontends. Repeating recovery is safe.
A `rollback-needs-attention` receipt means recovery did not complete; inspect locally.
Retain all backups, private receipts and the original container after success.

## Validation and limits

Local automated checks cover stateful simulated Docker transitions, failures before
and after mutation (lost responses), runtime drift, explicit recovery, interruptions,
backup/SQL failures, host-lock exclusion, repeat-attempt refusal, and no-mutation dry
runs. The actual generated SQL is executed on synthetic PostgreSQL via PGlite,
including forced second-migration failure and grant checks. CI runs these tests.
Hatif runtime tests and relevant existing application regressions are also run.

This is not an actual Docker cutover rehearsal or a new production verification.
TestSprite is not installed in this cloud environment; its additional service tests
are unverified. Install/configure its CLI with `testsprite setup` if those are needed.
The server dry run, actual apply, and real user sign-in/business-flow confirmation
remain outstanding. Do not report the feature as live until those steps finish.

Local results for this tooling update: 13 dispatcher test methods (including
failure/lost-response subcases), release-plan and Hatif runtime tests, combined
transaction success/rollback tests, existing operations database and document API
tests, Hatif/draft regressions, production build, TypeScript and the 78-route/six-category
baseline all passed. GitHub CI results are separate from these local results.
