#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   post-deploy-check.sh <backend_service> <frontend_service_or_empty> <nginx_service> <backend_health_url> <frontend_health_url>

BACKEND_SERVICE="${1:-stockdashboard-backend}"
FRONTEND_SERVICE="${2:-}"
NGINX_SERVICE="${3:-nginx}"
BACKEND_HEALTH_URL="${4:-http://127.0.0.1:8000/docs}"
FRONTEND_HEALTH_URL="${5:-http://127.0.0.1/}"

check_service() {
  local svc="$1"
  if [[ -z "$svc" ]]; then
    return 0
  fi
  local state
  state="$(systemctl is-active "$svc" || true)"
  if [[ "$state" != "active" ]]; then
    echo "ERROR: service '$svc' is not active (state=$state)"
    return 1
  fi
  echo "OK: service '$svc' is active"
}

check_http() {
  local url="$1"
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)"
  if [[ "$code" != "200" ]]; then
    echo "ERROR: health check failed for $url (status=$code)"
    return 1
  fi
  echo "OK: $url responded with 200"
}

echo "==> Post-deploy validation started"
check_service "$BACKEND_SERVICE"
check_service "$FRONTEND_SERVICE"
check_service "$NGINX_SERVICE"
check_http "$BACKEND_HEALTH_URL"
check_http "$FRONTEND_HEALTH_URL"
echo "==> Post-deploy validation passed"
