# Password recovery release — 9 November 2026

## Deployment

- Existing HestiaCP mailbox uses `mail.kohlestate-ksa.online:587` with verified STARTTLS. SMTP authentication succeeded locally and from the VPS. The user confirmed the delivery test reached the inbox.
- Supabase Auth retains its existing image, Google configuration, signup restrictions, redirect allowlist and all non-SMTP environment values. Only the six existing SMTP variables changed in the private Compose `.env`; runtime values were verified against it. Auth health passed after recreation.
- SMTP rollback checkpoint: `/home/debian/backups/kohl-smtp-20261109T000539Z`. Private contents include credentials and must never enter Git.
- Credential-free account frontend image: `sha256:9952da12bfb361d57f29e90c7b7f2ea2ebe25dd11a8b89d7aa5d628f74702850` (`kohl-account-frontend:20261109`), container `kohl_account_frontend`, internal network `kohl_external_portal`.
- Nginx proxies only `/auth/forgot-password`, `/auth/set-password`, `/api/auth/providers` and `/__account_ui/_next/static/` to that frontend. Account routes reject cross-build RSC navigation so Next falls back to a full document load. API/business requests still reach the main application.
- Proxy rollback checkpoint: `/home/debian/backups/kohl-account-20261109T001123Z`. Both NPM database advanced configuration and generated nginx configuration were backed up, validated and updated together.
- The main image remains `sha256:4128d746c87f15ff345a57de78be75b83c0551da0b368f202250484eb8c874d3`. Its grouped navigation and newer internal pages must not be rebuilt from this older checkout. The separate broker frontend remains unchanged.

## Verification

- TypeScript and production build passed. An initial prerender failure was fixed by restricting AccountShell to account routes, avoiding business pages without a DataProvider.
- Exact-image synthetic browser tests passed for ADMIN, CEO, HR, EMPLOYEE, BROKER, OWNER and TENANT: own-password submission, mismatch validation, global sign-out, bilingual messages, inactive/unapproved and signed-out guards, invalid recovery query/hash/code rejection, one-time implicit token initialization, and Arabic/English generic recovery requests.
- Release smoke checks verified account assets, public provider flags, main login/newer internal routes and the broker asset namespace.
- One real recovery request for the configured active approved test account returned HTTP 200. On 9 November 2026, the user confirmed that the email link opened, the new password was saved and sign-in with that password succeeded. The real end-to-end recovery check passed.
- Live synthetic browser tests passed for all seven roles and the recovery request/link guards. No real user password was changed by automation.
- TestSprite live public navigation/invalid-link test passed all six recorded steps: test `81bf74f9-545a-45d6-a021-dff47d330ba1`, run `448d82b5-43ad-4813-9f9b-a16e142a7794`. [Dashboard](https://www.testsprite.com/dashboard-v3/o/262d11f4-a3ed-5e4f-acd5-0bc69ada0f6a/projects/7930d491-00e4-4183-a083-9d1607d945f9/test-cases/81bf74f9-545a-45d6-a021-dff47d330ba1).

## Operational notes

- Users start at `/login` → forgot password, or directly `/auth/forgot-password`. Approved signed-in users can set their own password at `/auth/set-password`, including Google users. Role authorization continues to come from the private account profile.
- Recovery availability is served by the isolated frontend's public provider endpoint. The preserved main container's recovery flag remains untouched; check the public endpoint rather than that container flag when diagnosing availability.
- The local PortalDashboard and ChangePasswordModal links are drafts and were not included in this isolated release. Password recovery from login is deployed for all approved account roles.
- No migration, bulk password reset, self-signup or paid mail provider was introduced. Keep SMTP settings, test recipient, tokens and private checkpoints out of Git and public reports.
