#!/bin/bash
set -e

echo -e "\033[0;36m1. Syncing latest codebase to VPS repository...\033[0m"
git push vps main:main || ssh kohl-vps "cd ~/projects/kohl-crm-app && git fetch origin main && git reset --hard origin/main"

echo -e "\033[0;36m2. Building and restarting Next.js CRM app container on VPS...\033[0m"
ssh kohl-vps "cd ~/projects/kohl-crm-app && docker compose -f docker-compose.next.yml up -d --build"

echo -e "\033[0;36m3. Syncing static assets to VPS...\033[0m"
scp -r ./html_website/* kohl-vps:~/projects/my-new-site/html/ 2>/dev/null || true
ssh kohl-vps "cd ~/projects/my-new-site && docker compose restart" 2>/dev/null || true

echo -e "\033[0;32m✅ Deployment complete! Live at https://kohl.kohlestate-ksa.online and https://app.kohlestate-ksa.online\033[0m"
