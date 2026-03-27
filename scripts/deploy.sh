#!/usr/bin/env bash
set -euo pipefail

# One-command VPS release script for stockdashboard.
# Usage:
#   chmod +x scripts/deploy.sh scripts/post-deploy-check.sh
#   ./scripts/deploy.sh
#
# Optional env overrides:
#   APP_DIR=/var/www/stockdashboard
#   BRANCH=main
#   BACKEND_SERVICE=stockdashboard-backend
#   FRONTEND_SERVICE=stockdashboard-frontend   # optional, leave empty if frontend is static via nginx
#   NGINX_SERVICE=nginx
#   BACKEND_HEALTH_URL=http://127.0.0.1:8000/docs
#   FRONTEND_HEALTH_URL=http://127.0.0.1/
#   RUN_GIT_PULL=true

APP_DIR="${APP_DIR:-/var/www/stockdashboard}"
BRANCH="${BRANCH:-main}"
BACKEND_SERVICE="${BACKEND_SERVICE:-stockdashboard-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
RUN_GIT_PULL="${RUN_GIT_PULL:-true}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:8000/api/system/status}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://127.0.0.1/}"

FRONTEND_DIR="${FRONTEND_DIR:-$APP_DIR}"
BACKEND_DIR="${BACKEND_DIR:-$APP_DIR/backend_stockdashboard}"
if [[ ! -d "$BACKEND_DIR" && -d "$APP_DIR/dist/ani_fullstack_bundle/backend_stockdashboard" ]]; then
  BACKEND_DIR="$APP_DIR/dist/ani_fullstack_bundle/backend_stockdashboard"
fi

echo "==> Deploy started"
echo "    APP_DIR: $APP_DIR"
echo "    FRONTEND_DIR: $FRONTEND_DIR"
echo "    BACKEND_DIR: $BACKEND_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "ERROR: $APP_DIR is not a git repository."
  exit 1
fi

cd "$APP_DIR"

if [[ "$RUN_GIT_PULL" == "true" ]]; then
  echo "==> Updating code from origin/$BRANCH"
  git fetch origin
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

echo "==> Building frontend"
cd "$FRONTEND_DIR"
npm ci
npm run build

if [[ -d "$BACKEND_DIR" ]]; then
  echo "==> Updating backend environment"
  cd "$BACKEND_DIR"

  if [[ -f "requirements.txt" ]]; then
    python3 -m venv .venv
    # shellcheck disable=SC1091
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
  fi

  if [[ -f "alembic.ini" ]]; then
    echo "==> Running database migrations"
    # shellcheck disable=SC1091
    source .venv/bin/activate
    alembic upgrade head
  fi
fi

echo "==> Restarting services"
sudo systemctl restart "$BACKEND_SERVICE"
if [[ -n "$FRONTEND_SERVICE" ]]; then
  sudo systemctl restart "$FRONTEND_SERVICE"
fi
sudo systemctl restart "$NGINX_SERVICE"

echo "==> Running post-deploy checks"
"$APP_DIR/scripts/post-deploy-check.sh" \
  "$BACKEND_SERVICE" \
  "$FRONTEND_SERVICE" \
  "$NGINX_SERVICE" \
  "$BACKEND_HEALTH_URL" \
  "$FRONTEND_HEALTH_URL"

echo "==> Deploy completed successfully"
