#!/usr/bin/env bash
set -euo pipefail

# ANI Stock App VPS rollback script
# Usage:
#   chmod +x docs/deployment/rollback_vps.sh
#   ./docs/deployment/rollback_vps.sh <backend_commit>
#
# Example:
#   ./docs/deployment/rollback_vps.sh a1b2c3d

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backend_commit_hash>"
  exit 1
fi

BACKEND_COMMIT="$1"
APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_ROOT/stockdashboard}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend_stockdashboard}"
WEB_ROOT="${WEB_ROOT:-/var/www/ani-stock}"
BACKEND_SERVICE="${BACKEND_SERVICE:-ani-backend}"

echo "[1/3] Roll back frontend to last backup..."
if [ -d "${WEB_ROOT}-prev" ]; then
  sudo rsync -a --delete "${WEB_ROOT}-prev/" "$WEB_ROOT/"
  sudo systemctl reload nginx
else
  echo "No frontend backup found at ${WEB_ROOT}-prev"
fi

echo "[2/3] Roll back backend commit to $BACKEND_COMMIT..."
cd "$BACKEND_DIR"
git fetch --all --tags
git checkout "$BACKEND_COMMIT"
source .venv/bin/activate
pip install -r requirements.txt

echo "[3/3] Restart backend service..."
sudo systemctl restart "$BACKEND_SERVICE"
sudo systemctl status "$BACKEND_SERVICE" --no-pager

echo "Rollback completed."
