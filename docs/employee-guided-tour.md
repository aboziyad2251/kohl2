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
