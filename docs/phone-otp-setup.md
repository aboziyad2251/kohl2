# Phone OTP setup — 8 November 2026

The user requested phone-number login by sent token and subsequently required that the service be free. **Do not purchase SMS credit, register a paid service, or enable paid SMS delivery.** The earlier Unifonic setup suggestion is superseded by this cost constraint. Unifonic SMS is charged, so it is not a free solution; no account purchase, SMS transmission or activation has been performed.

Existing Google/password sign-in remains available without introducing an SMS service. Supabase supports authenticator-app TOTP MFA without SMS charges, but it is an additional factor after primary sign-in, not a code delivered to a phone number. Discuss that different flow with the user before implementing it. Do not advertise free production SMS delivery or represent limited trial credit as permanently free. See [Unifonic SMS pricing](https://docs.unifonic.com/articles/products-documentation/how-sms-is-charged-by-unifonic/a/definitions) and [Supabase TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp).

The user explicitly selected **keep existing Google and password login**. Both methods were subsequently verified with a real approved broker in the live browser, including routing to the broker portal. SMS and authenticator-app MFA remain disabled.

For the user's follow-up about free SMS: [Google Identity Platform pricing](https://cloud.google.com/identity-platform/pricing) stated during that research that the first ten SMS sent per day were not billed, but [Firebase phone-auth limits](https://firebase.google.com/docs/auth/limits) require the billing-enabled Blaze plan. This is a limited no-charge allowance within a paid-capable service, not a guarantee of zero charges or a native SMS provider for the current Supabase setup. [Twilio trial units](https://www.twilio.com/docs/api/errors/60628) expire or run out. No provider, account, billing or authentication integration was changed after this research.

Live readiness was inspected without printing secrets: self-hosted `supabase/gotrue:v2.189.0`, `GOTRUE_EXTERNAL_PHONE_ENABLED=false`, `GOTRUE_DISABLE_SIGNUP=true`, no configured SMS provider or credential values. This release does not enable phone auth or change any account. Existing password and Google sign-in remain available. Email recovery was subsequently enabled and verified on 9 November 2026; see `password-recovery-release.md` for the current state.

## Historical paid SMS setup — on hold under the free-service requirement

1. Create the business account using [Unifonic getting started](https://docs.unifonic.com/articles/products-documentation/sms-02-getting-started).
2. Request a **transactional** sender name for Kohl and complete the business documents requested in the provider's secure dashboard. See [sender registration](https://docs.unifonic.com/articles/products-documentation/sms-06-sender-id-registration/).
3. After approval, create the SMS application and keep its credentials privately outside Git. Do not paste secrets, identity documents or OTPs into chat. Agree SMS pricing/spending limits before buying credit or sending chargeable test traffic.
4. Tell the agent only that the account/sender is ready and where the restricted credential file is stored. Select an authorized test recipient privately for the real delivery test.

## Implementation when the provider is ready

This paid-SMS implementation is on hold. Revisit it only if the user later explicitly accepts provider charges; the current requirement is free service.

- Inspect the installed Auth version's supported Send SMS hook configuration. Unifonic is a custom provider integration, not one of Supabase's built-in provider selections. Use a signed server-side [Send SMS hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) adapter; never expose the provider secret or OTP in client bundles/logs. Confirm the installed version supports the chosen hook before modifying Auth configuration.
- Supabase owns OTP generation, expiration, verification and session issuance. The adapter delivers only authenticated Auth hook requests. Enforce signature/timestamp/replay checks, bounded requests, provider error handling and delivery rate limits. Never create a parallel ad-hoc token login system.
- Add a bilingual phone/code flow with Saudi/international E.164 normalization, expiry/retry feedback, resend cooldown and `autocomplete="one-time-code"`. Request OTP with `shouldCreateUser:false`; public signup remains disabled. Gate UI availability until provider configuration and real delivery/verification pass.
- Bind a phone to the **existing approved Auth identity** only through a verified enrollment/admin process. A private-profile contact phone is not automatically a verified Auth login phone. Do not auto-create a second identity or silently link accounts by submitted phone/email. Private active account roles continue to control access, not editable Auth metadata.
- Recheck Admin/CEO-only provisioning, unapproved/disabled-user denial, wrong/expired/reused code denial, resend/rate limits, phone normalization, existing password/Google login and cross-role data isolation. Test the exact configuration in isolation before activation, then prove real SMS receipt and successful approved-account login with the authorized recipient.
- Obtain explicit approval before any required schema migration. The user's current deployment request authorizes the broker UI update; it is not a blanket migration approval.

Official references: [Supabase phone sign-in](https://supabase.com/docs/guides/auth/phone-login), [self-hosted phone configuration](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa). Provider setup and actual delivery are still pending.
