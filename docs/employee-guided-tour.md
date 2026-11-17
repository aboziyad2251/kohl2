# Employee interactive tour

Internal signed-in accounts receive an Arabic guided walkthrough with 24 core steps
plus one step per accessible navigation destination. External portals, login and
password pages do not mount it. The leasing-only account receives 25 steps.

Next, Back, step selection, Skip, Escape and Finish are supported. Native dialog
provides modal keyboard containment. Opening a section is explicit and closes the
modal, retaining the current step so the employee can return to the tour button.
No tour action creates or changes business records. It uses the existing canAccess
checks and does not grant permissions or change roles.

Completion/skip is stored per account and version in this browser's localStorage.
The tour opens again on another browser/device or after browser storage is cleared.
If storage is unavailable, closing still works but the tour may reappear after a
reload. A visible 'جولة النظام' button allows replay. Arabic content matches the
current application; English translation is not included in this version.

Synthetic tests cover at least 24 steps across permission sets and no unauthorized
destinations. Browser checks cover desktop (1440px) and mobile (390px), stepping,
selection, Escape, persisted dismissal, replay, section navigation and completion.
No real production user accounts or records were used.

Deployment pending. This branch includes the recovery source safeguard from
fix/disable-email-recovery and does not include the incomplete operations employee
permission work. Preserve the live account frontend's recovery=false setting.
Before a main-image rollout validate persistent Hatif through prepare_hatif_runtime
and retain the original runtime for recovery. No database migration is required.

## Server preparation

The user authorized rollout. Application commit `5f2ca19334e459a617b415578d47cd9cd2522583`
passed GitHub run 44067054868 on Node 20/22. `prepare-tour-release.py` pins that
source, checks the existing main/broker/account images and recovery=false, validates
Hatif, builds from a clean Git archive with public build settings only, and runs the
exact image against isolated synthetic Auth/API services. It checks that live runtime
has not changed, then records private original/candidate configuration and an image
acceptance receipt. There are no production SQL writes, container stops or deployment
commands in preparation. Share only its resulting image ID and private plan path.
The cutover dispatcher must be bound to that resulting image/plan before deployment.

## Pinned cutover

Operator preparation passed for image
`sha256:bdc7734c1dacfa8cc32a71de0c272da46f2576504d0e768c36d1cf8ca1a6317a`,
plan `/home/debian/backups/kohl-tour-plan-j7h1w0xv`.
`release-tour.py --plan <directory>` defaults to read-only verification of the image,
source label, private HTTP acceptance digest, unchanged runtimes and persistent Hatif.
`--apply --approved-image <exact image>` replaces main only. A durable attempt marker
blocks accidental repeat apply. No SQL, session revocation or account changes occur.

Failures during cutover restore the original app. The old container and private
runtime snapshots are retained. After interruption, use the actual printed release
folder with `--rollback <release-folder>` and
`--approved-image sha256:df561ba5ca8da66172ea97edd4390fecb9e3e0e9b6f034f68b08689f3e9ed259`.
Recovery refuses an unrelated main container or changed Hatif snapshot. Do not delete
attempt markers or runtime files to force retry. This script has its own tour-specific
validation/cutover/recovery paths; historical release entry points are not invoked.

Twelve stateful unit tests cover dry-run non-mutation, exact-plan/receipt validation,
Hatif checks before stop, failed Docker mutations and lost replies, health failure,
signals, repeated recovery and durable failure receipts. Production deployment is
pending the operator's result.
