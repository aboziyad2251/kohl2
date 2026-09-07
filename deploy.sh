#!/bin/bash
set -e

echo -e "\033[0;36mSyncing web files to VPS...\033[0m"
scp -r ./html_website/* kohl-vps:~/projects/my-new-site/html/

echo -e "\033[0;36mReloading container...\033[0m"
ssh kohl-vps "cd ~/projects/my-new-site && docker compose restart"

echo -e "\033[0;32mDeployment complete! Live at https://kohl.kohlestate-ksa.online\033[0m"
