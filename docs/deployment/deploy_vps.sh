#!/usr/bin/env bash
set -euo pipefail

# ANI Stock App VPS deploy script
# Usage:
#   chmod +x docs/deployment/deploy_vps.sh
#   ./docs/deployment/deploy_vps.sh

DOMAIN="${DOMAIN:-aycindustries.com}"
APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_ROOT/stockdashboard}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend_stockdashboard}"
WEB_ROOT="${WEB_ROOT:-/var/www/ani-stock}"
BACKEND_SERVICE="${BACKEND_SERVICE:-ani-backend}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/aycindustries.com}"

echo "[1/6] Pull latest frontend/backend sources..."
cd "$FRONTEND_DIR"
git pull
cd "$BACKEND_DIR"
git pull

echo "[2/6] Install/update backend dependencies..."
cd "$BACKEND_DIR"
source .venv/bin/activate
pip install -r requirements.txt

echo "[3/6] Build frontend..."
cd "$FRONTEND_DIR"
npm ci
npm run build

echo "[4/6] Backup current web root..."
if [ -d "$WEB_ROOT" ]; then
  sudo mkdir -p "${WEB_ROOT}-prev"
  sudo rsync -a --delete "$WEB_ROOT/" "${WEB_ROOT}-prev/"
fi

echo "[5/6] Publish frontend build..."
sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$FRONTEND_DIR/build/" "$WEB_ROOT/"

echo "[6/6] Restart services..."
sudo cp "$FRONTEND_DIR/docs/deployment/nginx-aycindustries.com.conf" "$NGINX_SITE"
sudo nginx -t
sudo systemctl restart "$BACKEND_SERVICE"
sudo systemctl reload nginx

echo "Deployment completed for $DOMAIN"
echo "Check: https://www.$DOMAIN (canonical site + API)"
