# Continue in Cloud
Prepared 2026-10-25 for the existing chat CRM handoff check.
Repository: https://github.com/aboziyad2251/kohl-crm-cloud (private), branch main.

This is an audited source snapshot, not the old public repository branch. source-manifest.json records original source hashes and the verified deployed image. No production data or secrets were exported.

Features present: cream/gold Arabic ERP styling with black/blue/light modes, mobile navigation, internal property GPS map, private media, Excel unit import with deed reuse and duplicate protection, residential/commercial classification, account-scoped navigation drafts, signed inbound Hatif call/WhatsApp ingestion with contact deduplication, and CRM refresh every five seconds while visible/online with focus/reconnect refresh and stale-response guards.

First task: check out the actual repository in the Cloud workspace, verify the commit, follow CLOUD_SETUP.md, run build/typecheck/mocked tests, and report exact results and Cloud environment status. GitHub file browsing alone is not a checked-out environment. If private-repo access is missing, request only the standard GitHub app repository grant.

No production deployment or database migration is part of this handoff. Keep production runtime environment/image override intact. Future schema changes need explicit user approval. Existing customer records, properties and deeds must be preserved. Await the next product task after setup.
