#!/usr/bin/env bash
# Quick health snapshot for ANI Stock master-agent orchestrator.
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:8000/api}"
WEB_URL="${WEB_URL:-https://www.aycindustries.com/}"

echo "=== ANI Stock Fleet Health ==="
echo "time: $(date -Iseconds)"
echo

status_code=0

check_json() {
  local name="$1"
  local url="$2"
  if resp=$(curl -sf --max-time 8 "$url" 2>/dev/null); then
    echo "[OK] $name"
    echo "$resp" | python3 -m json.tool 2>/dev/null | head -20
  else
    echo "[FAIL] $name — $url"
    status_code=1
  fi
  echo
}

check_json "system/status" "$API_BASE/system/status"
check_json "system/readiness" "$API_BASE/system/readiness"

# Detailed subagent list requires auth; fall back to orchestrator block in system/status.
ORCH_URL="$API_BASE/advisor/signals/orchestrator/status"
AUTH_HDR=()
if [[ -n "${API_TOKEN:-}" ]]; then
  AUTH_HDR=(-H "Authorization: Bearer $API_TOKEN")
fi
if resp=$(curl -sf --max-time 8 "${AUTH_HDR[@]}" "$ORCH_URL" 2>/dev/null); then
  echo "[OK] orchestrator/subagents"
  echo "$resp" | python3 -m json.tool 2>/dev/null | head -20
elif status_resp=$(curl -sf --max-time 8 "$API_BASE/system/status" 2>/dev/null); then
  if echo "$status_resp" | python3 -c "import json,sys; d=json.load(sys.stdin); o=d.get('orchestrator') or {}; sys.exit(0 if o.get('running') else 1)" 2>/dev/null; then
    echo "[OK] orchestrator (from system/status; subagents endpoint needs API_TOKEN)"
    echo "$status_resp" | python3 -m json.tool 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('orchestrator',{}), indent=2))" | head -15
  else
    echo "[FAIL] orchestrator — not running per system/status"
    status_code=1
  fi
else
  echo "[FAIL] orchestrator/subagents — $ORCH_URL"
  status_code=1
fi
echo

if curl -sfI --max-time 8 "$WEB_URL" | head -1 | grep -q "200"; then
  echo "[OK] web $WEB_URL"
else
  echo "[FAIL] web $WEB_URL"
  status_code=1
fi
echo

if systemctl is-active --quiet ani-backend 2>/dev/null; then
  echo "[OK] systemd ani-backend active"
else
  echo "[WARN] ani-backend not active (or systemctl unavailable)"
fi

exit $status_code
