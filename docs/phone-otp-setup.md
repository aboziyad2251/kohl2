# Phone OTP setup — 8 November 2026

The user requested phone-number login by sent token and selected help with provider setup. They are creating a Unifonic business account and requesting a transactional sender name for Kohl. Account creation, sender approval and a funded SMS account remain external dependencies; do not claim SMS delivery works yet.

Live readiness was inspected without printing secrets: self-hosted `supabase/gotrue:v2.189.0`, `GOTRUE_EXTERNAL_PHONE_ENABLED=false`, `GOTRUE_DISABLE_SIGNUP=true`, no configured SMS provider or credential values. This release does not enable phone auth or change any account. Existing password and Google sign-in remain available; email recovery remains disabled until SMTP delivery is verified.

## User setup

1. Create the business account using [Unifonic getting started](https://docs.unifonic.com/articles/products-documentation/sms-02-getting-started).
2. Request a **transactional** sender name for Kohl and complete the business documents requested in the provider's secure dashboard. See [sender registration](https://docs.unifonic.com/articles/products-documentation/sms-06-sender-id-registration/).
3. After approval, create the SMS application and keep its credentials privately outside Git. Do not paste secrets, identity documents or OTPs into chat. Agree SMS pricing/spending limits before buying credit or sending chargeable test traffic.
4. Tell the agent only that the account/sender is ready and where the restricted credential file is stored. Select an authorized test recipient privately for the real delivery test.

## Implementation when the provider is ready

- Inspect the installed Auth version's supported Send SMS hook configuration. Unifonic is a custom provider integration, not one of Supabase's built-in provider selections. Use a signed server-side [Send SMS hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) adapter; never expose the provider secret or OTP in client bundles/logs. Confirm the installed version supports the chosen hook before modifying Auth configuration.
- Supabase owns OTP generation, expiration, verification and session issuance. The adapter delivers only authenticated Auth hook requests. Enforce signature/timestamp/replay checks, bounded requests, provider error handling and delivery rate limits. Never create a parallel ad-hoc token login system.
- Add a bilingual phone/code flow with Saudi/international E.164 normalization, expiry/retry feedback, resend cooldown and `autocomplete="one-time-code"`. Request OTP with `shouldCreateUser:false`; public signup remains disabled. Gate UI availability until provider configuration and real delivery/verification pass.
- Bind a phone to the **existing approved Auth identity** only through a verified enrollment/admin process. A private-profile contact phone is not automatically a verified Auth login phone. Do not auto-create a second identity or silently link accounts by submitted phone/email. Private active account roles continue to control access, not editable Auth metadata.
- Recheck Admin/CEO-only provisioning, unapproved/disabled-user denial, wrong/expired/reused code denial, resend/rate limits, phone normalization, existing password/Google login and cross-role data isolation. Test the exact configuration in isolation before activation, then prove real SMS receipt and successful approved-account login with the authorized recipient.
- Obtain explicit approval before any required schema migration. The user's current deployment request authorizes the broker UI update; it is not a blanket migration approval.

Official references: [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login), [self-hosted phone configuration](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa). Provider setup and actual delivery are still pending.
