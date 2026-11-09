# Cloud setup
Use Node.js 22 and the committed package-lock.json. Select this private repository and main branch in the Cloud environment. If it is unavailable, grant the ChatGPT GitHub app access to this repository using GitHub repository access settings.

```sh
cp .env.example .env.local
npm ci
npm run build
npx tsc --noEmit
node tests/hatif.cjs
node tests/drafts.cjs
npm run dev -- --hostname 0.0.0.0
```

The template uses a local placeholder backend and disables Hatif/OAuth/recovery. Build and mocked checks need no production credentials. Login and real records need an isolated configured Supabase test instance and test users. The existing migrations are historical source; do not automatically apply them to any production database.

Do not copy production secrets into Cloud. Hatif tests mock all network/database calls. PDF generation additionally needs Chromium on the environment and PORTAL_CHROMIUM_PATH if its location differs.

If the GitHub connector cannot retrieve the three large form PNGs, retrieve cloud-assets/manifest.json and its base64 parts, then run python scripts/restore-cloud-assets.py. Each restored image is SHA-256 verified. Prefer a complete native Git checkout in a published Cloud environment. .gitattributes preserves original source bytes across platforms.
