# Disable public email recovery

The recovery template no longer contains an email form or recovery API call. The
provider endpoint returns recovery=false independently of stale runtime flags.
The English unavailable text is present in the initial server-rendered HTML.
Login retains its password form and dashboard destination; its recovery information
link uses full-document navigation across the isolated account frontend boundary.
Login/recovery/provider routes send no-store headers.

Production topology from the recorded deployment: nginx routes forgot-password,
set-password and providers to kohl_account_frontend, not kohl_crm_app. Merely changing
the main image or its flag is insufficient. Do not run historical account release
scripts: they pin old main images and explicitly enable recovery.

Deployment pending. Obtain the current account container image and only its public
feature flags, plus the nginx recovery-route/cache directives. Preserve other runtime
settings privately. Set PASSWORD_RECOVERY_ENABLED=false when recreating the account
container, and retain this setting in its persistent launcher. Deploy the updated
account template with the existing /__account_ui asset prefix. Preserve set-password
and approved-user password management. The main app rollout should include the
provider/template safeguard as well; validate Hatif before any main stop.

A replacement container resets its app cache. Inspect actual proxy/CDN configuration
before purging: no CDN provider or cache directory has been verified. Do not delete
arbitrary directories. Purge the exact recovery/provider URLs where caching exists,
then verify uncached and normal requests repeatedly, English browser navigation,
absence of recovery inputs, providers recovery=false, and /login HTTP 200 without
redirect to recovery. Existing downloaded browser scripts need a full reload.

This change disables the app recovery UI. It does not claim to disable Supabase's
separate /auth/v1/recover endpoint or SMTP. No production deployment or cache purge
has been performed from this workspace.
