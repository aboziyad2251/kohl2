# Grouped navigation restored — 9 November 2026

The user reported that navigation categories had reverted, and selected restoring the complete previous release before safely reapplying the broker design.

## Cause and recovery

The broker UI release rebuilt an outdated live source checkout. Its source/image drift check protected the files it patched, but did not prove that the full checkout represented the previously running image. The earlier image contained grouped navigation, search, favorites and seven additional page-manifest entries which were absent from that source checkout. Six page routes were consequently missing (the cooperation form remained reachable through a dynamic route).

The complete preserved main image was restored: `sha256:4128d746c87f15ff345a57de78be75b83c0551da0b368f202250484eb8c874d3`, tagged `kohl-main:nav-restored-20261109`, container `kohl_crm_app`. It retains all 32 page-manifest entries. Recovery checkpoint: `/home/debian/backups/kohl-nav-restore-20261108T230403Z`. UTC backup timestamps are dated 8 November; the client date is 9 November. The displaced broker image/container is retained in the checkpoint for rollback. No database, record, account, Auth setting, password or runtime environment was changed by restoration.

The menu again contains الرئيسية، العقارات والأملاك، العقود والخدمات، العملاء والمبيعات، المالية والتقارير، الإدارة والوثائق. Arabic search, per-user favorites, collapsed groups and mobile section cards are restored from the preserved image, not an approximation of the old flat source.

## Broker design reapplied without rebuilding the main app

The broker/external portal frontend is now separately built: `kohl-broker-frontend:20261109`, digest `sha256:223b615202c1e8553c15b60c59d75e3079acd72f28c0f1a256ef4544960a76a6`, container `kohl_broker_frontend`. Stage: `/home/debian/projects/kohl-broker-frontend-20261109`. It has no production service key, database password or private backend-network attachment. Its only network is the dedicated internal `kohl_external_portal`, shared with `nginx_proxy_manager`.

Only exact `/portal` and `/__broker_ui/_next/static/` routing point to this frontend. All internal pages, login/Google callback, APIs and original `/_next/` assets remain on the restored main image. The asset namespace prevents cross-build chunk collisions. RSC requests crossing into `/portal` deliberately return 409 so Next falls back to a full document load; the portal shell uses full document redirects when leaving the external workspace. This boundary was tested through the real callback path with synthetic sessions.

Proxy checkpoint: `/home/debian/backups/kohl-broker-frontend-20261108T231147Z`. App proxy host 8's `advanced_config` and generated Nginx file are backed up and updated together, and `nginx -t` passed before reload. The already-active dedicated network was also added to only service `npm` in `/home/debian/n8n-docker/docker-compose.yml`, with a private original-file backup and parsed equality checks proving all other stack settings unchanged. No stack restart was needed. This makes the route survive proxy configuration regeneration/container recreation.

## Verification and future updates

- Preserved image preview and live checks: Today, calendar, audit, activity, settings, login and protected APIs; provider flags remain Google enabled/email recovery disabled. Main image digest is unchanged after portal deployment.
- Combined isolated and final live fixture-browser checks: all six categories, Arabic search, persistent favorites, collapsed groups, mobile menu without overflow, Google callback → broker portal, and broker redirection away from the internal dashboard.
- Broker frontend: Arabic/English desktop 1440px and mobile 390px, target values, empty states, payout-edit control absence and unaffected owner theme.
- TestSprite signed-out portal guard passed against the isolated combined preview: run `0183b3d3-3321-45b8-9b5b-aae9dd2979fd`, test `d26bec5f-7c1c-4f7a-a7ca-89a8e67b6560`. [Dashboard](https://www.testsprite.com/dashboard-v3/o/262d11f4-a3ed-5e4f-acd5-0bc69ada0f6a/projects/7930d491-00e4-4183-a083-9d1607d945f9/test-cases/d26bec5f-7c1c-4f7a-a7ca-89a8e67b6560). This guard does not test authenticated business records.
- UI/business Auth requests in fixture-browser checks are intercepted; no production fixture or password was changed. Screenshots are private under ignored `tmp/pdfs`. Earlier real broker Google/password acceptance is recorded separately in the broker review document.

**Do not rebuild or replace the main app from this checkout or the live source directory until the complete newer source has been recovered and reconciled.** The canonical recovery baseline is the preserved main image; local source and GitHub do not include all of its newer modules. Retain its tag, stopped rollback containers and private checkpoints. The previous whole-app broker build/deploy helper is retired. Future releases must compare route manifests and grouped-navigation behavior against this baseline, not only source hashes, and must preserve the isolated asset boundary.

Password self-service work is still a separate unverified local draft (`set-password`, password modal and portal link); it was deliberately excluded from this restoration and frontend build. SMTP details are still pending from the user, and email recovery remains disabled.
