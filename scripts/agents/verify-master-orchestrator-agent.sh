#!/usr/bin/env bash
# Verify master-agent-orchestrator skill + Cursor agent + fleet health.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Verify master-agent-orchestrator ==="

test -f .cursor/agents/master-agent-orchestrator.md
test -f .cursor/skills/master-agent-orchestrator/SKILL.md
test -f .cursor/skills/master-agent-orchestrator/scripts/check-fleet-health.sh

python3 - <<'PY'
import pathlib, re, sys
p = pathlib.Path(".cursor/agents/master-agent-orchestrator.md")
text = p.read_text()
if not re.search(r"^---\s*\nname:\s*master-agent-orchestrator", text, re.M):
    sys.exit("agent missing name: master-agent-orchestrator")
if "description:" not in text.split("---", 2)[1]:
    sys.exit("agent missing description")
print("OK: agent frontmatter")
PY

echo "Running fleet health check..."
.cursor/skills/master-agent-orchestrator/scripts/check-fleet-health.sh

echo "PASS: master-agent-orchestrator"
