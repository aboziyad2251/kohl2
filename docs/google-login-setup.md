# Approved-account Google login

Password login remains available to existing approved accounts. The Google button stays disabled until the provider is configured. OAuth callbacks validate the Supabase session and private application profile; an Auth identity alone never grants ERP or portal access.

Create a Web application OAuth client in Google Cloud. Request only standard identity scopes (openid, email and profile). Use:

- Application origin: `https://app.kohlestate-ksa.online`
- Authorized redirect URI: `https://kohl.kohlestate-ksa.online/auth/v1/callback`

Store the downloaded client JSON privately on the VPS, outside the repository. Configure Auth with `GOTRUE_EXTERNAL_GOOGLE_ENABLED`, `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID`, `GOTRUE_EXTERNAL_GOOGLE_SECRET` and `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI`. Keep `DISABLE_SIGNUP=true`. Explicitly allow the application redirect `https://app.kohlestate-ksa.online/auth/callback`.

Set application `GOOGLE_LOGIN_ENABLED=true` only after Auth settings report Google enabled and the complete provider flow is tested. Existing approved emails should resolve to their existing Supabase identity; verify this with one approved account and one unapproved Google account. Never enable public signup to work around identity-linking problems.

When Google is enabled, executive user creation provisions a passwordless Auth identity and private role/links before activation; no invitation email is needed. The WhatsApp text can be copied by the executive. The email owner must authenticate with Google to obtain a session. No user-editable metadata determines application roles.

Google OAuth cannot be tested end-to-end until real client credentials are available. SMTP remains necessary for emailed password recovery and email invitations while Google is disabled.

Provider configuration reference: https://supabase.com/docs/guides/self-hosting/self-hosted-oauth
