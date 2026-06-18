#!/usr/bin/env bash
# Validate a sub-agent brief has all 5 context layers.
# Usage: validate-context-package.sh path/to/brief.md
set -euo pipefail

FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 path/to/brief.md"
  exit 1
fi

BODY="$(tr '[:upper:]' '[:lower:]' <"$FILE")"
missing=0

require_section() {
  local label="$1"
  local pattern="$2"
  if ! grep -qiE "$pattern" <<<"$BODY"; then
    echo "MISSING: $label"
    missing=$((missing + 1))
  fi
}

require_section "Identity Context" 'identity'
require_section "World Context" 'world'
require_section "Task Context" 'task'
require_section "Example Context" 'example'
require_section "Constraint Context" 'constraint'

if [[ $missing -gt 0 ]]; then
  echo "FAIL: $missing required layer(s) missing in $FILE"
  exit 1
fi

echo "OK: all 5 context layers present in $FILE"
