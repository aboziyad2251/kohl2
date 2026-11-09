# Workspace navigation release candidate

## Release scope

This candidate adds grouped navigation, Arabic section search, account-specific favorites, Today, calendar, activity, and a settings hub. It also corrects report fallback provenance, nested navigation, and tab deep links. Full behavior and test scope are in `WORKSPACE-NAVIGATION-UPDATE.md`.

The office handoff is available as a patch/source bundle. The draft pull request is the review path for the production candidate. No production service is changed by opening it.

## Build and review gates

- Review the final pull request diff, especially user-scoped calendar reads and executive-only activity/status endpoints.
- The `Workspace release checks` workflow builds and runs mocked tests on Node 20 (the existing Dockerfile major) and Node 22 (the Cloud setup recommendation). These checks use `.env.example`, never production credentials. A workflow's existence is not evidence that it passed; inspect the actual run for the candidate commit.
- Local validation uses the available Node 24 runtime. Authenticated UI checks use isolated mock records. Docker image execution, production RLS/schema parity, live provider health, and PDF/browser availability require separate confirmation in the configured deployment environment.
- `.dockerignore` excludes local environment files, Git metadata, generated output, and local private directories from the Docker build context. The existing Dockerfile, runtime major, dependencies, and production overrides are preserved.
- Use the existing approved public Supabase URL and anon/publishable key for the client build. Server credentials remain in the deployment platform's existing runtime secret configuration; never place service-role keys in build arguments or `NEXT_PUBLIC_*` variables.
- No schema changes are required. Do not run any historical migration as part of this release.

## Configured test environment

Before production approval, test the candidate against an isolated backend with the same deployed schema and permission policies. Use synthetic Admin/CEO, HR, employee, owner, tenant, and broker accounts. Confirm the new calendar returns only allowed records and partial errors remain visible. Check the original map, deeds/import, attachments, drafts, Hatif mock suite, and document/PDF flows.

Confirm the actual deployment host/platform, service name, current image identifier, runtime configuration override, public build settings, and rollback mechanism from the deployment system. This source snapshot does not contain an authoritative deployment configuration. `source-manifest.json` records the historical exported image only; it must not be treated as the current rollback target.

## Production approval and rollout

`AGENTS.md` requires: “Production migrations and deployments require explicit user approval for the specific change.” Approval must identify the final candidate and intended existing service after review and test gates. Preparing a candidate or selecting “prepare a production release” does not itself deploy it.

After approval, the operator should use the existing deployment mechanism to build the reviewed commit, retain the currently running image for rollback, and update only the application image. Preserve the runtime environment/image override, data volumes, backend, private attachments, and Hatif configuration. No generic shell command here guesses those service-specific values.

Immediately verify normal login and page navigation, new Today/calendar/settings views, role denials for protected endpoints, mobile navigation, and an existing document/PDF using the approved test procedure. Do not create synthetic customer records or send webhook traffic to production as an automatic smoke test.

If the application fails these checks, restore the recorded pre-release application image using the same deployment mechanism and runtime configuration. Since this candidate has no migrations, rollback does not require restoring or modifying customer data. Keep the database and webhook configuration intact.

## Current readiness

Office handoff: complete. Source implementation and mocked checks: complete. Draft candidate: https://github.com/aboziyad2251/kohl-crm-cloud/pull/1. Initial release commit `5ddd6d1` passed Node 20/22 CI in run `40214571824`; the final refined head must pass its own checks. Deployment target/access and isolated real-backend validation: not configured in this Cloud workspace. Production approval: pending for the final candidate. Production deployment: not performed.

## KR extension (2026-10-26)

The new KR/property extension adds a reviewed migration, private report workflow,
CEO approval, agenda tasks and a22:00 Riyadh scheduler. The navigation-only statements
above describe the earlier candidate1cef81c. Use docs/KR-CLOSING-REPORT.md for the
new scope, validation, migration order, runtime configuration and rollback requirements.
The old navigation image/ZIP does not contain this extension. No production migration
or new deployment has been performed by this chat. Current live image identity still
requires office verification; the user has supplied a working signed-in screenshot.
