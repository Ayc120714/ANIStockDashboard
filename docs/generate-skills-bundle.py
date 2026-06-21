#!/usr/bin/env python3
"""Regenerate docs/ANI_STOCK_CURSOR_SKILLS_COMPLETE.md — skills, rules, agents, and setups."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # stockdashboard
REPO = ROOT.parent  # /opt/ani-stock
OUT = ROOT / "docs" / "ANI_STOCK_CURSOR_SKILLS_COMPLETE.md"
USER_SKILLS = Path.home() / ".cursor" / "skills"
USER_RULES = Path.home() / ".cursor" / "rules"

HEADER = """# ANI Stock — Complete Cursor Setup Bundle (skills, rules, agents, infrastructure)

Single-file reference to recreate the **full ANI Stock Cursor + VPS agent setup** on a new machine.

---

## Part 0 — Enable everything (fresh setup checklist)

### A. Clone repos (VPS recommended layout)

```bash
sudo mkdir -p /opt/ani-stock
sudo chown -R "$USER:$USER" /opt/ani-stock
cd /opt/ani-stock
git clone https://github.com/Ayc120714/ANIStockDashboard.git stockdashboard
git clone https://github.com/Ayc120714/backend_stockdashboard.git backend_stockdashboard
```

### B. Install Cursor project rules + skills + agents

From this document, create files at the **Install path** shown in each section:

| What | Where |
|------|--------|
| Repo-root rules (3) | `/opt/ani-stock/.cursor/rules/*.mdc` |
| Project rules (4) | `stockdashboard/.cursor/rules/*.mdc` |
| Project skills (10) | `stockdashboard/.cursor/skills/<name>/` |
| Project agents (2) | `stockdashboard/.cursor/agents/*.md` |
| User skills (optional) | `~/.cursor/skills/<name>/` |
| User rules (optional) | `~/.cursor/rules/*.mdc` |

```bash
# After extracting files from this bundle:
chmod +x /opt/ani-stock/stockdashboard/.cursor/skills/*/scripts/*.sh
chmod +x /opt/ani-stock/stockdashboard/scripts/vps_git_push.sh
chmod +x /opt/ani-stock/scripts/verify-linux-dev-setup.sh
```

### C. Open workspace in Cursor

```bash
# File: /opt/ani-stock/fullstack.code-workspace (see Part E)
cursor /opt/ani-stock/fullstack.code-workspace
```

Set Python interpreter: `backend_stockdashboard/.venv/bin/python`

Verify Linux paths:

```bash
bash /opt/ani-stock/scripts/verify-linux-dev-setup.sh
```

### D. Backend (systemd)

```bash
cd /opt/ani-stock/backend_stockdashboard
python3 -m venv .venv
source .venv/bin/activate && pip install -r requirements.txt
cp .env.production.example .env   # edit DATABASE_URL, secrets, SMTP
sudo cp deploy/systemd/ani-backend.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ani-backend
```

### E. Frontend production build

Create `stockdashboard/.env.production`:

```env
REACT_APP_API_URL=https://www.aycindustries.com/api
REACT_APP_TRADE_API_URL=https://www.aycindustries.com/api
```

```bash
cd /opt/ani-stock/stockdashboard
npm ci && npm run build
sudo mkdir -p /var/www/ani-stock
sudo rsync -av --delete build/ /var/www/ani-stock/
```

### F. Nginx

```bash
sudo cp /opt/ani-stock/stockdashboard/docs/deployment/nginx-aycindustries.com.conf \\
  /etc/nginx/sites-available/aycindustries.com
sudo ln -sf /etc/nginx/sites-available/aycindustries.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### G. Mobile APK artifacts

```bash
mkdir -p /opt/ani-stock/mobile-artifacts
/opt/ani-stock/stockdashboard/.cursor/skills/skillhelp/scripts/publish-release-apk.sh "Initial publish"
```

### H. Verify

```bash
systemctl is-active ani-backend
curl -s -o /dev/null -w "backend=%{http_code}\\n" http://127.0.0.1:8000/api/system/status
curl -sSI https://www.aycindustries.com/mobile/ani-stock-release.apk | head -3
```

### I. Agent behavior summary

| Layer | Purpose |
|-------|---------|
| **Rules** (`.mdc`) | Always-on or glob-scoped instructions Cursor injects every chat |
| **Skills** (`SKILL.md`) | Detailed workflows the agent reads when a task matches |
| **Agents** (`.md`) | Custom subagent definitions for orchestrator / context engineering |
| **Scripts** | Executable gates: test → publish APK → restart → push |

**Workflow chain for a typical fix:** `fix-regression-guard` → implement + test → `auto-restart-after-change` / `vps-restart` → `submit-to-mainline-after-verify` (commit + push).

---

## VPS path reference

| Resource | Path |
|----------|------|
| Repo root | `/opt/ani-stock` |
| Web app | `/opt/ani-stock/stockdashboard` |
| Mobile | `/opt/ani-stock/stockdashboard/mobile_isolated` |
| Backend | `/opt/ani-stock/backend_stockdashboard` |
| Public web root | `/var/www/ani-stock/` |
| Mobile APK | `/opt/ani-stock/mobile-artifacts/ani-stock-release.apk` |
| Update manifest | `/opt/ani-stock/mobile-artifacts/DOWNLOAD.json` |
| Backend service | `ani-backend` (systemd) |
| GitHub remote | `git@github.com:Ayc120714/ANIStockDashboard.git` |

---

## Index

### Part 1 — Cursor rules (`.mdc`)

**Repo root** (`/opt/ani-stock/.cursor/rules/`)

1. submit-to-mainline-after-verify
2. use-all-available-skills
3. linux-server

**Project** (`stockdashboard/.cursor/rules/`)

4. auto-restart-after-change
5. fix-regression-guard
6. master-agent-orchestrator
7. web-mutation-refresh-guard

**User** (`~/.cursor/rules/`)

8. context7 (optional — pairs with find-docs skill)

### Part 2 — Cursor agents

1. master-agent-orchestrator
2. context-engineering-subagents

### Part 3 — Project skills

1. auto-restart-after-change · 2. mobile-app-fix-ship · 3. fix-regression-guard · 4. master-agent-orchestrator · 5. context-engineering-subagents · 6. web-mutation-refresh-guard · 7. mobile-regression-guard · 8. skillhelp · 9. vps-restart · 10. publish-mobile-apk

### Part 4 — User skills

11. find-docs · 12. postgres-db-architecture

### Part 5 — Infrastructure & deployment files

1. fullstack.code-workspace · 2. ani-backend.service · 3. nginx-aycindustries.com.conf · 4. verify-linux-dev-setup.sh · 5. vps_git_push.sh · 6. VPS enablement checklist

---
"""


def embed_file(path: Path, title: str, install_hint: str, lang: str | None = None) -> str:
    if not path.exists():
        return f"\n\n---\n\n# {title}\n\n**Install path:** `{install_hint}`\n\n*(missing: {path})*\n"

    text = path.read_text(encoding="utf-8")
    if lang is None:
        if path.suffix == ".sh":
            lang = "bash"
        elif path.suffix in {".md", ".mdc"}:
            lang = "markdown"
        elif path.suffix == ".json":
            lang = "json"
        elif path.suffix == ".conf":
            lang = "nginx"
        elif path.suffix == ".service":
            lang = "ini"
        else:
            lang = "text"

    return (
        f"\n\n---\n\n# {title}\n\n"
        f"**Install path:** `{install_hint}`\n\n"
        f"```{lang}\n{text.rstrip()}\n```\n"
    )


def main() -> None:
    parts: list[str] = [HEADER]

    # Part 1 — Rules
    parts.append("\n\n# PART 1 — CURSOR RULES\n")

    repo_rules = [
        (REPO / ".cursor/rules/submit-to-mainline-after-verify.mdc", "Rule: submit-to-mainline-after-verify", ".cursor/rules/submit-to-mainline-after-verify.mdc"),
        (REPO / ".cursor/rules/use-all-available-skills.mdc", "Rule: use-all-available-skills", ".cursor/rules/use-all-available-skills.mdc"),
        (REPO / ".cursor/rules/linux-server.mdc", "Rule: linux-server", ".cursor/rules/linux-server.mdc"),
    ]
    for path, title, hint in repo_rules:
        parts.append(embed_file(path, title, f"/opt/ani-stock/{hint}"))

    project_rules = [
        ("auto-restart-after-change.mdc", "Rule: auto-restart-after-change"),
        ("fix-regression-guard.mdc", "Rule: fix-regression-guard"),
        ("master-agent-orchestrator.mdc", "Rule: master-agent-orchestrator"),
        ("web-mutation-refresh-guard.mdc", "Rule: web-mutation-refresh-guard"),
    ]
    for fname, title in project_rules:
        parts.append(embed_file(
            ROOT / ".cursor/rules" / fname,
            title,
            f"stockdashboard/.cursor/rules/{fname}",
        ))

    parts.append(embed_file(
        USER_RULES / "context7.mdc",
        "User rule: context7",
        "~/.cursor/rules/context7.mdc",
    ))

    # Part 2 — Agents
    parts.append("\n\n# PART 2 — CURSOR AGENTS\n")
    for agent in sorted((ROOT / ".cursor/agents").glob("*.md")):
        parts.append(embed_file(
            agent,
            f"Agent: {agent.stem}",
            f"stockdashboard/.cursor/agents/{agent.name}",
        ))

    # Part 3 — Project skills
    parts.append("\n\n# PART 3 — PROJECT SKILLS\n")
    project_files = [
        ("auto-restart-after-change/SKILL.md", "Skill: auto-restart-after-change"),
        ("auto-restart-after-change/scripts/restart-for-changes.sh", "Script: auto-restart-after-change/scripts/restart-for-changes.sh"),
        ("mobile-app-fix-ship/SKILL.md", "Skill: mobile-app-fix-ship"),
        ("mobile-app-fix-ship/scripts/ship-mobile-fix.sh", "Script: mobile-app-fix-ship/scripts/ship-mobile-fix.sh"),
        ("fix-regression-guard/SKILL.md", "Skill: fix-regression-guard"),
        ("fix-regression-guard/examples.md", "Supplement: fix-regression-guard/examples.md"),
        ("master-agent-orchestrator/SKILL.md", "Skill: master-agent-orchestrator"),
        ("master-agent-orchestrator/notifications.md", "Supplement: master-agent-orchestrator/notifications.md"),
        ("master-agent-orchestrator/examples/watchlist-fix-briefs.md", "Supplement: master-agent-orchestrator/examples/watchlist-fix-briefs.md"),
        ("master-agent-orchestrator/scripts/check-fleet-health.sh", "Script: master-agent-orchestrator/scripts/check-fleet-health.sh"),
        ("context-engineering-subagents/SKILL.md", "Skill: context-engineering-subagents"),
        ("context-engineering-subagents/reference.md", "Supplement: context-engineering-subagents/reference.md"),
        ("context-engineering-subagents/templates/subagent-brief.md", "Template: context-engineering-subagents/templates/subagent-brief.md"),
        ("context-engineering-subagents/scripts/validate-context-package.sh", "Script: context-engineering-subagents/scripts/validate-context-package.sh"),
        ("web-mutation-refresh-guard/SKILL.md", "Skill: web-mutation-refresh-guard"),
        ("mobile-regression-guard/SKILL.md", "Skill: mobile-regression-guard"),
        ("skillhelp/SKILL.md", "Skill: skillhelp"),
        ("skillhelp/scripts/publish-release-apk.sh", "Script: skillhelp/scripts/publish-release-apk.sh"),
        ("vps-restart/SKILL.md", "Skill: vps-restart"),
        ("publish-mobile-apk/SKILL.md", "Skill: publish-mobile-apk"),
        ("publish-mobile-apk/scripts/publish-release-apk.sh", "Script: publish-mobile-apk/scripts/publish-release-apk.sh"),
    ]
    skills_root = ROOT / ".cursor/skills"
    for rel, title in project_files:
        sub = rel
        parts.append(embed_file(
            skills_root / rel,
            title,
            f"stockdashboard/.cursor/skills/{sub}",
        ))

    # Part 4 — User skills
    parts.append("\n\n# PART 4 — USER SKILLS\n")
    user_files = [
        ("find-docs/SKILL.md", "User skill: find-docs"),
        ("postgres-db-architecture/SKILL.md", "User skill: postgres-db-architecture"),
        ("postgres-db-architecture/reference.md", "Supplement: postgres-db-architecture/reference.md"),
        ("postgres-db-architecture/scripts/apply-db-architecture.sh", "Script: postgres-db-architecture/scripts/apply-db-architecture.sh"),
        ("postgres-db-architecture/scripts/verify-eod-archive.sh", "Script: postgres-db-architecture/scripts/verify-eod-archive.sh"),
    ]
    for rel, title in user_files:
        parts.append(embed_file(USER_SKILLS / rel, title, f"~/.cursor/skills/{rel}"))

    # Part 5 — Infrastructure
    parts.append("\n\n# PART 5 — INFRASTRUCTURE & DEPLOYMENT SETUP\n")
    infra = [
        (REPO / "fullstack.code-workspace", "Setup: fullstack.code-workspace", "/opt/ani-stock/fullstack.code-workspace", "json"),
        (REPO / "backend_stockdashboard/deploy/systemd/ani-backend.service", "Setup: ani-backend.service", "/etc/systemd/system/ani-backend.service", "ini"),
        (ROOT / "docs/deployment/nginx-aycindustries.com.conf", "Setup: nginx-aycindustries.com.conf", "/etc/nginx/sites-available/aycindustries.com", "nginx"),
        (REPO / "scripts/verify-linux-dev-setup.sh", "Setup: verify-linux-dev-setup.sh", "/opt/ani-stock/scripts/verify-linux-dev-setup.sh", "bash"),
        (ROOT / "scripts/vps_git_push.sh", "Setup: vps_git_push.sh", "stockdashboard/scripts/vps_git_push.sh", "bash"),
        (ROOT / "docs/deployment/VPS_ENABLEMENT_CHECKLIST.md", "Setup: VPS enablement checklist", "stockdashboard/docs/deployment/VPS_ENABLEMENT_CHECKLIST.md", "markdown"),
    ]
    for path, title, hint, lang in infra:
        parts.append(embed_file(path, title, hint, lang))

    parts.append(
        "\n\n---\n\n# End of bundle\n\n"
        "Regenerate this file:\n\n"
        "```bash\n"
        "python3 /opt/ani-stock/stockdashboard/docs/generate-skills-bundle.py\n"
        "```\n"
    )

    OUT.write_text("".join(parts), encoding="utf-8")
    lines = OUT.read_text(encoding="utf-8").count("\n")
    print(f"Wrote {OUT} ({OUT.stat().st_size:,} bytes, {lines:,} lines)")


if __name__ == "__main__":
    main()
