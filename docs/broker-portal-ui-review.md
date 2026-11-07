# Broker portal local review — 8 November 2026

Local review URL: `http://127.0.0.1:3110/portal`. Sign in through `/login` using an existing approved broker account. The development server is loopback-only. This UI change has not been published or deployed.

The broker workspace now matches the application's dark slate and emerald palette. It includes monthly closed-contract/earned-commission summaries, clearly labelled all-period paid/awaiting-payout totals, the existing six-month trend, contract/commission cards, and target progress. Arabic/English direction, mobile layout, empty states and navigation are supported. Overview puts the workspace before its alerts. Owner/tenant portal themes are unchanged; the shared broker panel also appears inside executive management.

Authorization and database behavior are unchanged. Brokers have no payout-edit controls; the existing executive-only workflow remains. Calculations use the existing scoped dashboard response, with currency totals summed in halalas. No account, migration, document, payment or production record was created for this change.

Validation passed: TypeScript (`npx tsc --noEmit`), existing action-center calculations, synthetic browser checks at 1440px/390px in Arabic/English, target values, absent broker edit controls, navigation, no horizontal overflow, broker empty states and unchanged owner theme. Synthetic checks intercept all auth/business traffic; they do not prove real broker login acceptance. Private screenshots and the temporary visual-check harness are under ignored `tmp/pdfs`.

TestSprite local signed-out `/portal` guard and bilingual login passed: test `d26bec5f-7c1c-4f7a-a7ca-89a8e67b6560`, run `b791196a-07e6-4dcb-b591-e4fcaabb18a7`. This verifies sign-in protection, not authenticated broker records. Dashboard: https://www.testsprite.com/dashboard-v3/o/262d11f4-a3ed-5e4f-acd5-0bc69ada0f6a/projects/7930d491-00e4-4183-a083-9d1607d945f9/test-cases/d26bec5f-7c1c-4f7a-a7ca-89a8e67b6560
