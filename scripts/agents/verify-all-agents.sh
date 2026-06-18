#!/usr/bin/env bash
# Verify both local Cursor agents and their skills/scripts.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/verify-context-engineering-agent.sh"
"$DIR/verify-master-orchestrator-agent.sh"
echo "=== All agent verifications passed ==="
