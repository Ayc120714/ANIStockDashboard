#!/usr/bin/env bash
# Verify context-engineering subagent skill + Cursor agent manifest.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "=== Verify context-engineering-subagents ==="

test -f .cursor/agents/context-engineering-subagents.md
test -f .cursor/skills/context-engineering-subagents/SKILL.md
test -f .cursor/skills/context-engineering-subagents/templates/subagent-brief.md

.cursor/skills/context-engineering-subagents/scripts/validate-context-package.sh \
  .cursor/skills/context-engineering-subagents/templates/subagent-brief.md

# Agent frontmatter
python3 - <<'PY'
import pathlib, re, sys
p = pathlib.Path(".cursor/agents/context-engineering-subagents.md")
text = p.read_text()
if not re.search(r"^---\s*\nname:\s*context-engineering-subagents", text, re.M):
    sys.exit("agent missing name: context-engineering-subagents")
if "description:" not in text.split("---", 2)[1]:
    sys.exit("agent missing description")
print("OK: agent frontmatter")
PY

echo "PASS: context-engineering-subagents"
