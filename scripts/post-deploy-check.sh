#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   post-deploy-check.sh <backend_service> <frontend_service_or_empty> <nginx_service> <backend_health_url> <frontend_health_url>

BACKEND_SERVICE="${1:-stockdashboard-backend}"
FRONTEND_SERVICE="${2:-}"
NGINX_SERVICE="${3:-nginx}"
BACKEND_HEALTH_URL="${4:-http://127.0.0.1:8000/docs}"
FRONTEND_HEALTH_URL="${5:-http://127.0.0.1/}"
HEALTH_MAX_RETRIES="${HEALTH_MAX_RETRIES:-30}"
HEALTH_RETRY_DELAY_SEC="${HEALTH_RETRY_DELAY_SEC:-2}"
HEALTH_CURL_TIMEOUT_SEC="${HEALTH_CURL_TIMEOUT_SEC:-5}"

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
  local code=""
  local attempt=1
  local last_error=""

  while [[ "$attempt" -le "$HEALTH_MAX_RETRIES" ]]; do
    code="$(curl -sS --max-time "$HEALTH_CURL_TIMEOUT_SEC" -o /dev/null -w "%{http_code}" "$url" 2>/tmp/post_deploy_curl_err.$$ || true)"
    last_error="$(tr '\n' ' ' </tmp/post_deploy_curl_err.$$ || true)"

    if [[ "$code" == "200" ]]; then
      echo "OK: $url responded with 200 (attempt $attempt/$HEALTH_MAX_RETRIES)"
      rm -f /tmp/post_deploy_curl_err.$$
      return 0
    fi

    if [[ "$attempt" -lt "$HEALTH_MAX_RETRIES" ]]; then
      echo "WARN: health check not ready for $url (status=$code, attempt $attempt/$HEALTH_MAX_RETRIES), retrying in ${HEALTH_RETRY_DELAY_SEC}s..."
      sleep "$HEALTH_RETRY_DELAY_SEC"
    fi
    attempt=$((attempt + 1))
  done

  rm -f /tmp/post_deploy_curl_err.$$
  echo "ERROR: health check failed for $url after $HEALTH_MAX_RETRIES attempts (last status=$code)"
  if [[ -n "$last_error" ]]; then
    echo "ERROR: last curl message: $last_error"
  fi
  return 1
}

echo "==> Post-deploy validation started"
check_service "$BACKEND_SERVICE"
check_service "$FRONTEND_SERVICE"
check_service "$NGINX_SERVICE"
check_http "$BACKEND_HEALTH_URL"
check_http "$FRONTEND_HEALTH_URL"
echo "==> Post-deploy validation passed"
