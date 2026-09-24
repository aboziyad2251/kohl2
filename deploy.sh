#!/bin/bash
set -e

echo -e "\033[0;36m1. Pulling latest codebase and building Next.js CRM app on VPS...\033[0m"
ssh kohl-vps "cd ~/projects/kohl-crm-app && git fetch origin main && git reset --hard origin/main && docker compose -f docker-compose.next.yml up -d --build"

echo -e "\033[0;36m2. Syncing static assets to VPS...\033[0m"
scp -r ./html_website/* kohl-vps:~/projects/my-new-site/html/ 2>/dev/null || true
ssh kohl-vps "cd ~/projects/my-new-site && docker compose restart" 2>/dev/null || true

echo -e "\033[0;32m✅ Deployment complete! Live at https://kohl.kohlestate-ksa.online and https://app.kohlestate-ksa.online\033[0m"
