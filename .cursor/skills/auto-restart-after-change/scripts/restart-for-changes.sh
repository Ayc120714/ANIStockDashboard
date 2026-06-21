#!/usr/bin/env bash
# Restart ANI Stock VPS services based on changed files or explicit flags.
# Usage:
#   restart-for-changes.sh              # infer from git diff
#   restart-for-changes.sh --backend
#   restart-for-changes.sh --frontend
#   restart-for-changes.sh --all
set -euo pipefail

ROOT="/opt/ani-stock"
WEB="$ROOT/stockdashboard"
BACKEND="$ROOT/backend_stockdashboard"

RESTART_BACKEND=0
RESTART_FRONTEND=0

usage() {
  echo "Usage: $0 [--backend|--frontend|--all]" >&2
  exit 1
}

classify_paths() {
  local paths="$1"
  if echo "$paths" | grep -qE '^backend_stockdashboard/'; then
    RESTART_BACKEND=1
  fi
  if echo "$paths" | grep -qE '^stockdashboard/(src/|public/|package\.json|package-lock\.json|craco\.config|\.env)'; then
    RESTART_FRONTEND=1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend) RESTART_BACKEND=1; shift ;;
    --frontend) RESTART_FRONTEND=1; shift ;;
    --all) RESTART_BACKEND=1; RESTART_FRONTEND=1; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage ;;
  esac
done

if [[ "$RESTART_BACKEND" -eq 0 && "$RESTART_FRONTEND" -eq 0 ]]; then
  if ! command -v git >/dev/null 2>&1; then
    echo "[auto-restart] No flags and git unavailable — pass --backend, --frontend, or --all" >&2
    exit 1
  fi
  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[auto-restart] Not a git repo at $ROOT — pass --backend, --frontend, or --all" >&2
    exit 1
  fi
  CHANGED="$(git -C "$ROOT" diff --name-only HEAD 2>/dev/null; git -C "$ROOT" diff --name-only --cached HEAD 2>/dev/null)" || true
  CHANGED="$(echo "$CHANGED" | sort -u | grep -v '^$' || true)"
  if [[ -z "$CHANGED" ]]; then
    echo "[auto-restart] No changed files detected — nothing to restart."
    exit 0
  fi
  classify_paths "$CHANGED"
  echo "[auto-restart] Changed files:"
  echo "$CHANGED" | sed 's/^/  /'
fi

if [[ "$RESTART_BACKEND" -eq 0 && "$RESTART_FRONTEND" -eq 0 ]]; then
  echo "[auto-restart] Changes are skills/docs only — skipping server restart."
  exit 0
fi

if [[ "$RESTART_BACKEND" -eq 1 ]]; then
  echo "[auto-restart] Restarting backend (ani-backend)..."
  cd "$BACKEND"
  sudo systemctl daemon-reload && sudo systemctl restart ani-backend
fi

if [[ "$RESTART_FRONTEND" -eq 1 ]]; then
  echo "[auto-restart] Building and deploying frontend..."
  cd "$WEB"
  npm ci && npm run build
  sudo rsync -av --delete build/ /var/www/ani-stock/
  sudo nginx -t && sudo systemctl reload nginx
fi

echo "[auto-restart] Verifying..."
if [[ "$RESTART_BACKEND" -eq 1 ]]; then
  systemctl is-active ani-backend || true
  curl -s -o /dev/null -w "backend=%{http_code}\n" http://127.0.0.1:8000/api/system/status || true
fi

echo "[auto-restart] Done. Hard-refresh the browser if frontend was deployed."
