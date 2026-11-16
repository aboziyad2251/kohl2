# Restricted operations employee

Requested behavior: an individual employee can use operational property/apartment,
contract, CRM and leasing workflows, view financial information and submit receipts
and expenses, but cannot approve financial entries. Preserve designated manager
review followed by CEO approval. Deny all six office navigation modules: HR/payroll,
user administration, archive, comprehensive audit, activity and settings/integrations.
These are server/database boundaries, not merely hidden navigation items.

## Verified production checkpoint

Operator supplied the read-only inspection from `275642c` on 17 November 2026
(client date). Main is `sha256:df561ba5ca8da66172ea97edd4390fecb9e3e0e9b6f034f68b08689f3e9ed259`;
broker and account frontends remain at the preceding verified checkpoints. No target
Auth identity or employee row exists. Reviewers are active; the leasing switch and
operations core are installed. No account or production changes have been made.

The current EMPLOYEE role is insufficient: its archive policy grants all operations,
HR policies grant own-record reads/writes, and the internal finance core denies
ordinary employee general expenses. Legacy financial_transactions is executive-only.
Private accounts currently have no per-account operations capability column.

## Implementation boundaries

- Add a private per-account operations capability, default off. Grant it through an
  executive-only audited administrative path. Never identify the capability by email,
  display name, user-editable Auth metadata, or an existing employee's HR system_role.
- Apply restrictive policies to HR and archive for this capability, including direct
  REST access. Restrict relevant SECURITY DEFINER and service-client paths as well.
  Do not revoke other employees' existing permissions.
- Expose only the caller's effective capability to the UI, suppress the complete
  office group and deny direct routes. Prevent shared initial data loaders, search,
  calendar and exports from exposing restricted data.
- Expand operational reads/writes independently of executive authority. Do not make
  is_executive return true for this account or reuse admin session impersonation.
- Provide financial reads and pending receipt/expense submission. Keep approvals,
  reviewer configuration, document freeze and finalization exclusive to existing
  manager/CEO rules. Review legacy finance write paths so they cannot bypass approval.
- Keep account creation separate from deployment; private operator input holds all
  real personal data. Do not commit login identifiers, phone numbers or credentials.
  Do not fabricate national IDs, salaries or employment details to satisfy HR forms.

## Acceptance and rollout

Test allowed property/apartment creation and updates, operational customer access,
financial submission and rejection of approval. Test HR/archive/admin denial via UI,
direct URLs, REST/RPC, storage and exports; test spoofed metadata and unaffected
ordinary employees/executives/leasing identity. Use synthetic identities first.

A fresh backup, isolated migration rehearsal and exact-image HTTP checks must precede
cutover. Preserve persistent Hatif settings before stopping the main container.
Keep broker/account unchanged. Create the real employee only after the permission
checks pass. Report creation only after Auth plus private profile and access checks
succeed. Current state: preflight complete; implementation and creation pending.
