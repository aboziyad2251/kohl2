#!/bin/bash
# Real Estate Office Management System Deployment Script
# Domain: office.mabotargagh.online
# Hostinger VPS IP: 76.13.40.119

set -e

echo "🚀 Starting Automated Deployment for office.mabotargagh.online on Hostinger VPS (76.13.40.119)..."

VPS_IP="76.13.40.119"
VPS_USER="root"
PROJECT_DIR="/var/www/office_mabotargagh"

echo "1️⃣ Creating project directory on VPS if not exists..."
ssh ${VPS_USER}@${VPS_IP} "mkdir -p ${PROJECT_DIR}"

echo "2️⃣ Uploading codebase to VPS..."
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude '.netlify' ./ ${VPS_USER}@${VPS_IP}:${PROJECT_DIR}/

echo "3️⃣ Executing Docker Compose & Container deployment on VPS..."
ssh ${VPS_USER}@${VPS_IP} << 'ENDSSH'
set -e
cd /var/www/office_mabotargagh

# Build & restart container
docker-compose down --remove-orphans || true
docker-compose build --no-cache
docker-compose up -d

echo "Checking container status..."
docker ps | grep office_realestate

echo "Initializing isolated PostgreSQL schema and seed data on office_realestate_db..."
sleep 3
docker exec -i office_realestate_db psql -U postgres -d office_db < ./supabase/migrations/20260812000000_init_office_schema.sql || true

# 1. Apply HTTP Nginx configuration by default
if [ -d "/etc/nginx/sites-available" ]; then
    cp ./nginx/office.mabotargagh.online.conf /etc/nginx/sites-available/office.mabotargagh.online
    ln -sf /etc/nginx/sites-available/office.mabotargagh.online /etc/nginx/sites-enabled/
    nginx -t && (systemctl reload nginx || service nginx reload || true)
fi

# 2. Check if SSL cert already exists or try certbot webroot
CERT_FILE=$(ls /etc/letsencrypt/live/office.mabotargagh.online*/fullchain.pem 2>/dev/null | head -n 1 || true)

if [ -z "$CERT_FILE" ] && command -v certbot &> /dev/null; then
    echo "Attempting SSL certificate generation for office.mabotargagh.online..."
    mkdir -p /var/www/office_mabotargagh
    certbot certonly --webroot -w /var/www/office_mabotargagh -d office.mabotargagh.online --non-interactive --agree-tos -m admin@mabotargagh.online || true
    CERT_FILE=$(ls /etc/letsencrypt/live/office.mabotargagh.online*/fullchain.pem 2>/dev/null | head -n 1 || true)
fi

# 3. If SSL cert exists, activate HTTPS config
if [ -n "$CERT_FILE" ]; then
    echo "SSL Certificate active: $CERT_FILE"
    CERT_DIR=$(dirname "$CERT_FILE")
    sed -i "s|/etc/letsencrypt/live/office.mabotargagh.online|$CERT_DIR|g" ./nginx/office.mabotargagh.online.ssl.conf || true
    cp ./nginx/office.mabotargagh.online.ssl.conf /etc/nginx/sites-available/office.mabotargagh.online
    ln -sf /etc/nginx/sites-available/office.mabotargagh.online /etc/nginx/sites-enabled/
    nginx -t && (systemctl reload nginx || service nginx reload || true)
    echo "HTTPS configuration active!"
else
    echo "HTTP configuration active (SSL cert pending or rate-limited)."
fi
ENDSSH

echo "✅ Deployment completed successfully! Visit: http://office.mabotargagh.online"
