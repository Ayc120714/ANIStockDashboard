# ANI Stock — Complete Cursor Setup Bundle (skills, rules, agents, infrastructure)

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
sudo cp /opt/ani-stock/stockdashboard/docs/deployment/nginx-aycindustries.com.conf \
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
curl -s -o /dev/null -w "backend=%{http_code}\n" http://127.0.0.1:8000/api/system/status
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


# PART 1 — CURSOR RULES


---

# Rule: submit-to-mainline-after-verify

**Install path:** `/opt/ani-stock/.cursor/rules/submit-to-mainline-after-verify.mdc`

```markdown
---
description: After verify + tests pass, commit and push changes to origin main — do not stop at local deploy only
alwaysApply: true
---

# Submit to mainline after verify

Work is **incomplete** until verified changes are on **`origin/main`**. Do not stop after local tests or VPS deploy alone.

## Required order (never skip)

```
1. Implement the change (+ regression test per fix-regression-guard)
2. Verify behavior (run affected tests; spot-check UI/API if applicable)
3. Run test gates — all green:
   - Web: cd /opt/ani-stock/stockdashboard && npm run test:ci
   - Mobile: cd /opt/ani-stock/stockdashboard/mobile_isolated && npm run test:ci
   - Backend: cd /opt/ani-stock/backend_stockdashboard && pytest (when backend changed)
4. Deploy/restart on VPS (auto-restart-after-change / vps-restart)
5. Commit on main with a clear message (why, not just what)
6. Push to GitHub mainline
```

## Git workflow

Repo: `/opt/ani-stock/stockdashboard` · branch: **`main`**

```bash
cd /opt/ani-stock/stockdashboard
git status && git diff
git add <only files from this task>
git commit -m "$(cat <<'EOF'
fix(web): short summary of why

EOF
)"
bash scripts/vps_git_push.sh
```

- **Never** commit secrets (`.env`, tokens, credentials)
- **Never** `git push --force` to `main`
- **Never** amend unless user explicitly asked and HEAD is unpushed
- Stage only task-related paths; do not bulk-add unrelated files

## Completion gate

Before telling the user the task is done, confirm:

- [ ] Relevant `test:ci` / `pytest` passed
- [ ] VPS restart/deploy verified (when deployable code changed)
- [ ] Commit exists on `main`
- [ ] `git push origin main` succeeded (or `scripts/vps_git_push.sh` exited 0)

If push fails (SSH/auth), report the error and leave `git status` + next steps — do not claim the task is shipped.
```


---

# Rule: use-all-available-skills

**Install path:** `/opt/ani-stock/.cursor/rules/use-all-available-skills.mdc`

```markdown
---
description: At the start of every chat, scan and apply all relevant agent skills before acting
alwaysApply: true
---

# Use all available skills

At the **start of every new chat** (and before starting non-trivial work), proactively scan and use skills — do not rely on memory alone.

## Step 1 — Inventory skills

Check all skill sources:

1. **Skills listed in the session** (`available_skills` / attached skills)
2. **Project skills:** `ani-stock/stockdashboard/.cursor/skills/**/SKILL.md`
3. **User skills:** `/root/.cursor/skills/**/SKILL.md`
4. **Cursor skills:** `/root/.cursor/skills-cursor/**/SKILL.md`

## Step 2 — Read before acting

For every skill that **might** apply to the user's goal:

- **Read the full `SKILL.md` immediately** — do not summarize or skip it
- **Follow its workflow end-to-end** (commands, gates, output format)
- **Do not announce** you will use a skill without actually reading and applying it

If multiple skills apply, use **all** of them (e.g. fix + regression test + restart).

## Step 3 — Quick routing

| Topic | Skill |
|-------|-------|
| Bug fix / behavior change (web/mobile) | `fix-regression-guard` |
| Library/API docs, version-specific syntax | `find-docs` |
| PostgreSQL schema, hot/cold tables, EOD archive | `postgres-db-architecture` |
| Mobile APK publish / `/skillhelp` | `skillhelp` |
| Spawning Task sub-agents | `context-engineering-subagents`, `master-agent-orchestrator` |
| Cursor SDK / `@cursor/sdk` automation | `sdk` |
| PR merge-ready loop, CI triage | `babysit` |
| Split work into PRs | `split-to-prs` |
| Bugbot / security review requests | `review-bugbot`, `review-security` |
| Canvas / analytical UI artifacts | `canvas` |
| Cursor hooks, rules, skills, settings | `create-hook`, `create-rule`, `create-skill`, `update-cursor-settings` |
| After deploy/restart on VPS | `vps-restart`, `auto-restart-after-change` |
| Ship verified work to GitHub main | `submit-to-mainline-after-verify` rule |
| Web mutation cache refresh | `web-mutation-refresh-guard` |

When unsure whether a skill applies, **read it** — err on the side of using skills.

## Step 4 — Confirm coverage

Before marking work complete, verify:

- Every applicable skill was read and followed
- Skill-mandated tests, restarts, or publish steps were run
- Nothing was skipped because it seemed optional
```


---

# Rule: linux-server

**Install path:** `/opt/ani-stock/.cursor/rules/linux-server.mdc`

```markdown
---
description: Ubuntu VPS deployment — never use Windows Python paths or tooling
alwaysApply: true
---

# Linux server (Ubuntu)

This environment is **Ubuntu Linux** at `/opt/ani-stock/`. It is **not** a Windows dev machine.

- Python: `backend_stockdashboard/.venv/bin/python` and `source .venv/bin/activate`
- **Never** use `.venv/Scripts/python.exe`, `Activate.ps1`, or `C:\` paths
- Open workspace: `/opt/ani-stock/fullstack.code-workspace`
- Production: `systemd` (`ani-backend`) + `nginx`; not IIS or Windows services
- Verify: `bash /opt/ani-stock/scripts/verify-linux-dev-setup.sh`
```


---

# Rule: auto-restart-after-change

**Install path:** `stockdashboard/.cursor/rules/auto-restart-after-change.mdc`

```markdown
---
description: After deployable code changes, automatically restart backend and/or frontend on the VPS without waiting for the user to ask.
globs:
  - stockdashboard/src/**/*
  - stockdashboard/mobile_isolated/**/*
  - backend_stockdashboard/**/*
alwaysApply: false
---

Read and follow `.cursor/skills/auto-restart-after-change/SKILL.md` when finishing any task that changes app code.

- Run tests first (`fix-regression-guard`), then restart the required server(s).
- Use `scripts/restart-for-changes.sh` or exact commands from `vps-restart`.
- Do not mark work complete until restart is verified.
```


---

# Rule: fix-regression-guard

**Install path:** `stockdashboard/.cursor/rules/fix-regression-guard.mdc`

```markdown
---
description: Every fix on web or mobile must ship with an enabled regression unit test; run test:ci before build or APK publish.
globs:
  - stockdashboard/src/**/*
  - stockdashboard/mobile_isolated/src/**/*
alwaysApply: false
---

Read and follow `.cursor/skills/fix-regression-guard/SKILL.md` on every bug fix or behavior change.

- **Web:** add tests under `src/**/*.test.js`, run `npm run test:ci` before build/deploy.
- **Mobile:** add tests under `mobile_isolated/__tests__/`, run `npm run test:ci` before APK publish.
- Do not mark work complete without a passing test that guards the fix.
```


---

# Rule: master-agent-orchestrator

**Install path:** `stockdashboard/.cursor/rules/master-agent-orchestrator.mdc`

```markdown
---
description: >-
  Multi-agent workflows: generate 5-layer sub-agent context, spawn children
  with Composer 2.5, monitor health, require regression tests, wire web+mobile
  notifications.
globs:
  - .cursor/skills/**/*
  - stockdashboard/.cursor/skills/**/*
alwaysApply: false
---

# Master agent + sub-agents

When the user asks for sub-agents, parallel agents, context engineering, or orchestrated full-stack work:

1. Read `.cursor/skills/context-engineering-subagents/SKILL.md` — build 5-layer briefs per child.
2. Read `.cursor/skills/master-agent-orchestrator/SKILL.md` — spawn Task children with `model: composer-2.5-fast`.
3. Run `.cursor/skills/master-agent-orchestrator/scripts/check-fleet-health.sh` before/after deploy-class work.
4. Every fix must follow `.cursor/skills/fix-regression-guard/SKILL.md` (unit test + test:ci).

Child prompts must include Identity, World, Task, Example, and Constraint sections — never rely on parent chat history.
```


---

# Rule: web-mutation-refresh-guard

**Install path:** `stockdashboard/.cursor/rules/web-mutation-refresh-guard.mdc`

```markdown
---
description: Admin tier and LT/ST watchlist mutations must update UI immediately; ship regression tests per web-mutation-refresh-guard skill.
globs:
  - stockdashboard/src/pages/AdminUsersPage.js
  - stockdashboard/src/components/AdminUserDirectoryTables.js
  - stockdashboard/src/pages/LongTermPage.js
  - stockdashboard/src/pages/ShortTermPage.js
  - stockdashboard/src/api/watchlist.js
  - stockdashboard/src/api/auth.js
  - stockdashboard/src/utils/adminUserTiers.js
  - stockdashboard/src/utils/watchlistLocalMutation.js
  - stockdashboard/src/utils/adminUsersReload.js
alwaysApply: false
---

When changing admin user directory or LT/ST watchlist mutation flows, read and follow `.cursor/skills/web-mutation-refresh-guard/SKILL.md`. Every fix needs an enabled regression test in the mapped `*.test.js` file and `npm run test:ci` must pass before deploy.
```


---

# User rule: context7

**Install path:** `~/.cursor/rules/context7.mdc`

```markdown
---
alwaysApply: true
---

Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Resolve library: `npx ctx7@latest library <name> "<user's question>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
```


# PART 2 — CURSOR AGENTS


---

# Agent: context-engineering-subagents

**Install path:** `stockdashboard/.cursor/agents/context-engineering-subagents.md`

```markdown
---
name: context-engineering-subagents
description: >-
  Generates 5-layer context briefs (Identity, World, Task, Example, Constraint)
  for child Task sub-agents on ANI Stock. Use proactively before spawning
  explore/shell/generalPurpose children; validates briefs with
  validate-context-package.sh. Default child model composer-2.5-fast.
---

You are the **Context Engineering Sub-Agent** for ANI Stock.

## On invoke

1. Read `.cursor/skills/context-engineering-subagents/SKILL.md` and `templates/subagent-brief.md`.
2. Ask for (or infer) the master goal and child subtask scope.
3. Produce a complete brief with all **5 layers** using XML tags:
   - `<identity_context>`
   - `<world_context>`
   - `<task_context>`
   - `<example_context>` (one good + one bad)
   - `<constraint_context>`
4. Run verification:
   ```bash
   .cursor/skills/context-engineering-subagents/scripts/validate-context-package.sh /tmp/subagent-brief.md
   ```
   (Write brief to a temp file first.)
5. Return the brief plus a one-line “ready for Task spawn” confirmation.

## Rules

- **Minimal high-signal tokens** — no full chat history, no unrelated subtasks.
- **One task per brief** — split into multiple briefs if needed.
- **ANI Stock paths**: web `stockdashboard/src/`, mobile `mobile_isolated/`, backend `backend_stockdashboard/`.
- **Every fix** in a child brief must require a regression test (`fix-regression-guard` skill).

## Output

Return the brief markdown, validation result (`OK` or errors), and recommended `subagent_type` + `model: composer-2.5-fast`.
```


---

# Agent: master-agent-orchestrator

**Install path:** `stockdashboard/.cursor/agents/master-agent-orchestrator.md`

```markdown
---
name: master-agent-orchestrator
description: >-
  Master orchestrator for ANI Stock: decomposes work, spawns parallel Task
  children (composer-2.5-fast), runs fleet health checks, surfaces status,
  wires web+mobile notifications, and enforces regression tests. Use proactively
  for multi-surface fixes (web/mobile/backend) or sub-agent fleet workflows.
---

You are the **Master Agent Orchestrator** for ANI Stock on this VPS (`/opt/ani-stock`).

## On invoke

1. Read `.cursor/skills/master-agent-orchestrator/SKILL.md` and `context-engineering-subagents` skill.
2. Restate goal + acceptance criteria in one paragraph.
3. Decompose into parallel-safe subtasks; assign `subagent_type` per child.
4. **Baseline health** (always):
   ```bash
   .cursor/skills/master-agent-orchestrator/scripts/check-fleet-health.sh
   ```
5. Generate a 5-layer brief per child; validate each brief.
6. Spawn children in **one message** (parallel Task calls), `model: composer-2.5-fast`.
7. Synthesize child summaries into a status table:

   | Component | Status | Detail |
   |-----------|--------|--------|
   | Backend API | ok/degraded/down | |
   | Subagents | count | from orchestrator status |
   | Web tests | pass/fail | test:ci |
   | Mobile tests | pass/fail | if touched |

8. For any **fix**: add unit tests; run `npm run test:ci` (web/mobile) and `pytest` (backend).
9. Deploy when requested: `vps-restart` / `skillhelp` skills.
10. **Notifications**: if conditions hit, use `notifications.md` patterns (web inbox + mobile native).

## Spawn rules

| Task | subagent_type |
|------|----------------|
| Map codebase | `explore` (readonly) |
| Tests, build, git | `shell` |
| Implement fix | `generalPurpose` |
| Review diff | `bugbot` (readonly) |

Never paste the master plan wholesale into a child prompt — only that child's brief.

## Done checklist

- [ ] Health check run (before + after deploy-class work)
- [ ] All children returned summaries
- [ ] Regression tests added for every behavioral fix
- [ ] test:ci green on touched surfaces
- [ ] User status table emitted
```


# PART 3 — PROJECT SKILLS


---

# Skill: auto-restart-after-change

**Install path:** `stockdashboard/.cursor/skills/auto-restart-after-change/SKILL.md`

```markdown
---
name: auto-restart-after-change
description: >-
  Automatically restarts the ANI Stock frontend and/or backend after code fixes,
  feature work, or skill updates that ship deployable changes — without waiting
  for the user to ask. Use when finishing any web, API, mobile, or VPS task;
  after creating or editing project skills under .cursor/skills/; or when the
  user says restart servers, apply changes, or deploy the fix.
---

# Auto-restart after change

> **Do not mark a task complete** until the required server(s) have been restarted and verified. **Never** wait for the user to say "restart" — run restarts automatically when deployable code changed.

## When to restart

| Changed paths | Restart |
|---------------|---------|
| `backend_stockdashboard/**` (`.py`, `.env`, migrations, systemd unit) | **Backend** |
| `stockdashboard/src/**`, `public/**`, `package.json`, web build config | **Frontend** (build + nginx) |
| Both areas in one task | **Backend first**, then **frontend** |
| Only `stockdashboard/.cursor/skills/**` (docs/instructions, no code) | **Skip** — no server restart |
| Skill + code in same task | Restart per code rows above |
| `mobile_isolated/**` only (no API change) | **Skip backend** unless API/auth contract changed; use `publish-mobile-apk` for APK |
| DB migration added | Backend restart **after** running migration (`vps-restart` migration block) |

## Required workflow (end of every deployable task)

```
- [ ] 1. Tests pass (fix-regression-guard)
- [ ] 2. Decide backend / frontend / both from changed files
- [ ] 3. Run restart script OR exact vps-restart blocks
- [ ] 4. Verify service health (curl / systemctl)
- [ ] 5. Tell user what was restarted + hard-refresh if frontend
```

**Step 3 is mandatory** — not optional, not "user can restart later".

## One command (preferred on VPS)

From repo root, after tests pass:

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/auto-restart-after-change/scripts/restart-for-changes.sh
```

With explicit scope:

```bash
# Backend only
.../restart-for-changes.sh --backend

# Frontend only
.../restart-for-changes.sh --frontend

# Both (default when git diff touches both trees)
.../restart-for-changes.sh --all
```

The script uses `git diff` (staged + unstaged) against `HEAD` when no flags are passed. If git is unavailable, pass `--backend`, `--frontend`, or `--all` explicitly.

## Manual commands (same as vps-restart)

Read **`.cursor/skills/vps-restart/SKILL.md`** for full detail. Use these **exact** blocks:

**Backend**

```bash
cd /opt/ani-stock/backend_stockdashboard
sudo systemctl daemon-reload && sudo systemctl restart ani-backend
```

**Frontend**

```bash
cd /opt/ani-stock/stockdashboard
npm ci && npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
sudo nginx -t && sudo systemctl reload nginx
```

Order when both: **backend → frontend**.

## Verify (required)

```bash
systemctl is-active ani-backend
curl -s -o /dev/null -w "backend=%{http_code}\n" http://127.0.0.1:8000/api/system/status
```

Frontend: confirm build timestamp or spot-check the changed screen. Tell the user to **hard-refresh** (Ctrl+Shift+R).

## After creating or editing a project skill

1. If the skill session **only** added/edited files under `.cursor/skills/` → no restart.
2. If the same session **also** changed app code → run restarts per the table above before closing.
3. When authoring skills that reference new API behavior or UI flows, assume code was changed and restart accordingly.

## Local dev (non-VPS)

If `npm start` or `uvicorn` is running in a terminal:

| Change | Action |
|--------|--------|
| Frontend React files | CRA hot-reloads; if stale, restart `npm start` in `stockdashboard/` |
| Backend Python | Restart uvicorn / `ani-backend` locally |
| `.env` or deps | Full backend restart |

On Linux VPS production path (`/opt/ani-stock`), always use systemd + nginx workflow above — not `npm start`.

## Related skills

- **`.cursor/skills/vps-restart/SKILL.md`** — canonical restart commands + migrations
- **`.cursor/skills/fix-regression-guard/SKILL.md`** — tests before restart
- **`.cursor/skills/publish-mobile-apk/SKILL.md`** — mobile release after API changes

## Report to user

Always include in the completion summary:

1. Which service(s) restarted (backend / frontend / both / skipped)
2. Verify command output (HTTP code, `active`)
3. Hard-refresh reminder if frontend deployed
```


---

# Script: auto-restart-after-change/scripts/restart-for-changes.sh

**Install path:** `stockdashboard/.cursor/skills/auto-restart-after-change/scripts/restart-for-changes.sh`

```bash
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
```


---

# Skill: mobile-app-fix-ship

**Install path:** `stockdashboard/.cursor/skills/mobile-app-fix-ship/SKILL.md`

```markdown
---
name: mobile-app-fix-ship
description: >-
  Ships completed ANI Stock mobile app fixes end-to-end: regression tests,
  publish and enable the release APK on aycindustries.com/mobile, then commit
  and push source changes to GitHub. Use after any mobile_isolated bug fix,
  UI fix, or feature correction; when the user says ship the app fix, publish
  APK and push to GitHub, or /mobile-app-fix-ship.
---

# Mobile app fix — publish APK + push to GitHub

When a **mobile app fix is complete**, do not stop at code changes. Finish by **enabling the new APK** for users and **submitting the fix to GitHub**.

## Required order (never skip)

```
- [ ] 1. Fix + regression test (mobile-regression-guard)
- [ ] 2. npm run test:ci — all green
- [ ] 3. Publish APK → public download + DOWNLOAD.json
- [ ] 4. Verify curl checks pass
- [ ] 5. git commit fix + version bump files
- [ ] 6. git push to GitHub (no force push)
```

Steps 1–2 are covered by **`.cursor/skills/mobile-regression-guard/SKILL.md`** and **`.cursor/skills/fix-regression-guard/SKILL.md`**.

## One command (preferred)

From the VPS after the fix is implemented and reviewed:

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/mobile-app-fix-ship/scripts/ship-mobile-fix.sh \
  "Short release notes for update popup" \
  "fix(mobile): describe the fix in one line"
```

Script steps:

1. `publish-release-apk.sh` — typecheck, `test:ci`, build APK, copy to `mobile-artifacts/`, sync `DOWNLOAD.json`, bump next-cycle version in source
2. Verify public URLs (HTTP 200, manifest matches APK size)
3. Stage only mobile fix + version files (see below)
4. Commit with the provided message (or auto-generated `fix(mobile): …`)
5. `git push origin HEAD` — **never** `--force` on `main`/`master`

## Manual workflow (same order)

### A. Publish APK

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/skillhelp/scripts/publish-release-apk.sh \
  "Short release notes for update popup"
```

See **`.cursor/skills/skillhelp/SKILL.md`** for paths, version sync, and verification curls.

### B. Verify download is enabled

```bash
curl -sSI https://www.aycindustries.com/mobile/ani-stock-release.apk | head -5
curl -sS https://www.aycindustries.com/mobile/DOWNLOAD.json | python3 -m json.tool | head -12
```

Expect HTTP **200**; `Content-Length` must match `sizeBytes` in `DOWNLOAD.json`.

### C. Commit and push to GitHub

Repo root: `/opt/ani-stock/stockdashboard` (remote: `origin` → `Ayc120714/ANIStockDashboard`).

```bash
cd /opt/ani-stock/stockdashboard

git status
git diff

git add mobile_isolated/src/ mobile_isolated/__tests__/ \
  mobile_isolated/package.json \
  mobile_isolated/android/app/build.gradle \
  mobile_isolated/src/core/config/appVersion.js

git commit -m "$(cat <<'EOF'
fix(mobile): one-line summary of the fix

Optional second line with release note context.
EOF
)"

git push origin HEAD
```

## What to stage

| Include | Exclude |
|---------|---------|
| `mobile_isolated/src/**` (fix) | `node_modules/`, `coverage/`, `dist/` |
| `mobile_isolated/__tests__/**` (regression test) | `.vscode/`, `.env`, `android/app/build/` |
| Version files after publish (bumped for next cycle) | Unrelated web/backend files unless same fix |
| `package.json`, `build.gradle`, `appVersion.js` | Secrets, keystores, `local.properties` |

`DOWNLOAD.json` and the live APK live under `/opt/ani-stock/mobile-artifacts/` on the VPS — **not** in the git repo. Publishing updates the server; git tracks source + version metadata.

## Commit message style

Match recent history: imperative, scoped when helpful.

```
fix(mobile): collapse LT/ST watchlist panels to reduce clutter
fix(mobile): restore in-app APK update prompt after login
```

Release notes passed to `ship-mobile-fix.sh` arg 1 appear in the in-app **App update available** popup (`DOWNLOAD.json` → `releaseNotes`).

## Agent checklist (report when done)

1. Fix summary and test file(s) that guard it
2. `test:ci` result (e.g. 107/107 passed)
3. Published version (`version` + `versionCode` from `DOWNLOAD.json`)
4. Public APK URL verified (HTTP 200)
5. Git commit hash and branch pushed
6. GitHub remote branch name (user can open PR if not on `main`)

## When NOT to run full ship

- Fix is web-only or backend-only → use **publish-mobile-apk** only if mobile clients need the backend change; no mobile source commit needed
- Tests failing → fix first; **do not publish**
- User explicitly asked for code-only / no push → skip steps 5–6

## Related skills

- [skillhelp/SKILL.md](../skillhelp/SKILL.md) — APK build, copy, manifest
- [mobile-regression-guard/SKILL.md](../mobile-regression-guard/SKILL.md) — tests before publish
- [fix-regression-guard/SKILL.md](../fix-regression-guard/SKILL.md) — universal test gate
- [publish-mobile-apk/SKILL.md](../publish-mobile-apk/SKILL.md) — backend + mobile publish context

## Script reference

- [scripts/ship-mobile-fix.sh](scripts/ship-mobile-fix.sh)
```


---

# Script: mobile-app-fix-ship/scripts/ship-mobile-fix.sh

**Install path:** `stockdashboard/.cursor/skills/mobile-app-fix-ship/scripts/ship-mobile-fix.sh`

```bash
#!/usr/bin/env bash
# Ship a completed mobile app fix: test → publish APK → verify → commit → push.
# Usage: ship-mobile-fix.sh "Release notes for update popup" ["git commit subject"]
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
REPO_DIR="${REPO_DIR:-${APP_ROOT}/stockdashboard}"
PUBLISH_SCRIPT="${PUBLISH_SCRIPT:-${REPO_DIR}/.cursor/skills/skillhelp/scripts/publish-release-apk.sh}"
NOTES="${1:-Mobile app update}"
COMMIT_SUBJECT="${2:-fix(mobile): ${NOTES}}"

if [[ ! -x "$PUBLISH_SCRIPT" ]]; then
  echo "ERROR: Publish script not found or not executable: $PUBLISH_SCRIPT"
  exit 1
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "ERROR: Git repo not found at $REPO_DIR"
  exit 1
fi

echo "=== [1/4] Publish release APK (typecheck + test:ci + build + manifest) ==="
"$PUBLISH_SCRIPT" "$NOTES"

echo ""
echo "=== [2/4] Verify public download ==="
APK_CODE=$(curl -sS -o /dev/null -w '%{http_code}' https://www.aycindustries.com/mobile/ani-stock-release.apk || true)
JSON_CODE=$(curl -sS -o /dev/null -w '%{http_code}' https://www.aycindustries.com/mobile/DOWNLOAD.json || true)
if [[ "$APK_CODE" != "200" || "$JSON_CODE" != "200" ]]; then
  echo "ERROR: Public URLs not ready (APK=$APK_CODE JSON=$JSON_CODE)"
  exit 1
fi
curl -sS https://www.aycindustries.com/mobile/DOWNLOAD.json | python3 -m json.tool | head -12

echo ""
echo "=== [3/4] Commit mobile fix + version bump ==="
cd "$REPO_DIR"

git add mobile_isolated/src/ mobile_isolated/__tests__/ \
  mobile_isolated/package.json \
  mobile_isolated/android/app/build.gradle \
  mobile_isolated/src/core/config/appVersion.js

if git diff --cached --quiet; then
  echo "WARN: No staged changes — skipping commit (fix may already be committed)."
else
  git commit -m "$(cat <<EOF
${COMMIT_SUBJECT}

Release notes: ${NOTES}
EOF
)"
fi

echo ""
echo "=== [4/4] Push to GitHub ==="
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  git push origin HEAD
else
  git push -u origin HEAD
fi

echo ""
echo "Ship complete."
echo "  Branch: ${BRANCH}"
echo "  APK:    https://www.aycindustries.com/mobile/ani-stock-release.apk"
echo "  Manifest: https://www.aycindustries.com/mobile/DOWNLOAD.json"
```


---

# Skill: fix-regression-guard

**Install path:** `stockdashboard/.cursor/skills/fix-regression-guard/SKILL.md`

```markdown
---
name: fix-regression-guard
description: >-
  Ensures every bug fix and behavior change on web or mobile ships with an
  enabled regression unit test and a CI gate so fixes are not lost later. Use
  when implementing any fix, feature correction, cache change, or when the user
  asks to protect work with tests.
---

# Fix Regression Guard

> **Whenever any fix is done** (web, mobile, or API), add or update its **corresponding unit test**, keep that test **enabled** (never skipped), and run the project test suite before build or release so the fix is not lost on the next change.

This applies to **all fixes** — not only admin/watchlist. Mutation-refresh patterns are one category; see `.cursor/skills/web-mutation-refresh-guard/SKILL.md` and `.cursor/skills/mobile-regression-guard/SKILL.md` for area-specific checklists.

## Required workflow (do not skip)

Every fix is **incomplete** until all steps pass:

```
- [ ] 1. Reproduce the failure (symptom + root cause)
- [ ] 2. Implement the minimal fix
- [ ] 3. Add or update a regression test that would fail without the fix
- [ ] 4. Run the full test suite locally — all tests green
- [ ] 5. Ensure CI / release scripts run those tests before build/APK/deploy
- [ ] 6. Note cache-key bumps or migration steps if the fix depends on invalidating stale state
```

**Do not mark the task done** until step 4 passes. **Do not hand off a release** until step 5 is confirmed.

## Universal rule (web + mobile)

| Rule | Requirement |
|------|-------------|
| **One fix → one test minimum** | Every behavioral fix gets at least one focused regression test in the same change set |
| **Tests stay on** | No `it.skip`, `test.skip`, `.only`, or commented-out assertions for the new test |
| **Extract when needed** | Move testable logic into `utils/` or `services/` so pages/components stay thin |
| **Name the bug** | Test title or comment states what broke and what correct behavior is |
| **Fail first** | Verify mentally (or by reverting) that the test fails on pre-fix code |
| **Gate releases** | `npm run test:ci` (web and mobile) must pass before `npm run build`, APK publish, or VPS deploy |

**No exceptions** for “small” fixes — if it was worth fixing, it is worth a test.

## What to test

| Fix type | Test target |
|----------|-------------|
| Pure logic (parse, validate, transform) | Unit test on the function/module |
| Hook or component behavior | Render/act test with stable inputs |
| Cache / persistence | Assert invalid data rejected; valid data accepted |
| API integration shape | Fixture matching real envelope; assert unwrap + row counts |
| Live refresh / polling | Assert refetch conditions (avoid loops; assert force-refresh when needed) |
| UI mutation (add/remove/tier change) | Optimistic update + cache bust helpers (see area skills) |

Prefer testing **behavior**, not implementation details. One focused test per root cause is enough.

## Regression test rules

1. **Name the bug** — test title or comment states what broke (e.g. "rejects empty trend grid cache").
2. **Fail first** — mentally verify the test would fail on the pre-fix code.
3. **No disabled tests** — never commit `it.skip`, `.only`, or commented-out assertions for the new test.
4. **Keep tests enabled in CI** — if the project has no test step in release workflows, add one in the same change.
5. **Avoid brittle structure-only checks** — assert meaningful outcomes (row counts, tier bucket, cache cleared), not mere key presence.

## CI gate (mandatory before release)

| Platform | Command | When to run |
|----------|---------|-------------|
| **Web** | `cd stockdashboard && npm run test:ci` | Before `npm run build` and VPS deploy |
| **Mobile** | `cd stockdashboard/mobile_isolated && npm run test:ci` | Before `npm run build`, APK publish, or VPS deploy (`test:ci` runs `lint:ci` + Jest) |
| **Backend** | `pytest` (or project test command) | Before service restart / deploy |

Release scripts (`publish-release-apk.sh`, `vps-restart`) must not skip the test step.

## Project-specific notes

### Web — `stockdashboard`

- Tests: `src/**/*.test.js` (utils, api, router)
- Command: `npm run test:ci`
- Area skill: `.cursor/skills/web-mutation-refresh-guard/SKILL.md` (admin tiers, LT/ST watchlist)
- Helpers: `adminUserTiers.js`, `watchlistLocalMutation.js`, `adminUsersReload.js`
- Page cache keys: `longTermWatchlist_v*`, `shortTermWatchlist_v*`

### Mobile — `stockdashboard/mobile_isolated`

- Tests: `mobile_isolated/__tests__/**/*.test.js`
- Command: `npm run test:ci` (then `npm run typecheck` before APK)
- Area skill: `.cursor/skills/mobile-regression-guard/SKILL.md`
- Fixtures: `__tests__/fixtures/`
- Cache bumps: `MOBILE_PAGE_CACHE_KEYS` in `dashboardCachePolicy.js`; test in `dashboardCachePolicy.test.js` / `pageCache.test.js`
- Publish: `.cursor/skills/skillhelp/SKILL.md` — tests **must** pass before APK copy

### VPS deploy (web + API)

- After backend or frontend fixes: `.cursor/skills/vps-restart/SKILL.md`
- Hard-refresh guidance for sessionStorage-cached pages

### Other repos

Discover test runner (`package.json`, `pytest.ini`) and mirror the same gate pattern.

## Anti-patterns (caused lost fixes)

- Fixing production code **without** a test
- Relying on manual QA or hard-refresh only
- Shipping APK or web build before `test:ci` passes
- `hasUsable` / cache checks that pass on **empty structure**
- Refetch tied to **visible row count** instead of **data presence**
- Reverting a large commit instead of surgical fix + regression test

## Done checklist (report to user)

When finishing **any** fix:

1. Which test file(s) guard the fix (path + test name)
2. Test command run and result (e.g. "web 36/36, mobile 80/80 passed")
3. Whether CI / publish script runs tests before release
4. Any cache-key bump or user action after install (pull-to-refresh, reinstall)

## Related skills (ANI Stock)

- `context-engineering-subagents` — 5-layer briefs for child Task sub-agents
- `master-agent-orchestrator` — spawn/monitor children, health, web+mobile notifications
- `web-mutation-refresh-guard` / `mobile-regression-guard` — mutation/cache patterns
```


---

# Supplement: fix-regression-guard/examples.md

**Install path:** `stockdashboard/.cursor/skills/fix-regression-guard/examples.md`

```markdown
# Fix Regression Guard — Examples

## Example 1: Empty cache treated as valid (trend reversal)

**Symptom:** B1–S3 tables show 0 matches; spinner stuck.

**Root cause:** `cacheHasUsableData` returned true for `{ daily, weekly, monthly }` keys with zero items; refetch loop on `trendVisibleRows === 0`.

**Fix:** Row-count validation + remove visible-row refetch trigger + cache key bump.

**Tests added:**
- `pageCache.test.js` — empty grid not usable
- `advisorHubCache.test.js` — `normalizeTrendGrid` unwrap + `countTrendGridRows`
- `dashboardCachePolicy.test.js` — cache key version + live refresh policy

**CI:** `npm run test:ci` before `android:apk:release`.

---

## Example 2: Pagination reset every render

**Symptom:** List pages jump back to page 1.

**Root cause:** `resetDeps = []` default created new array reference each render.

**Fix:** Stable `EMPTY_RESET_DEPS` + `resetSignature` in `usePagedList`.

**Test:** `usePagedList.test.js` — page stays on 2 when `resetDeps` omitted; resets when deps change.

---

## Example 3: Dashboard movers stale during market hours

**Symptom:** Gainers/losers not updating live.

**Root cause:** `need.movers` stayed false when cache had stale movers.

**Fix:** Force `need.indices/movers/watchlist/signals` during live session + 30s poll.

**Test:** `dashboardCachePolicy.test.js` — live session forces movers refresh even when cache looks complete.
```


---

# Skill: master-agent-orchestrator

**Install path:** `stockdashboard/.cursor/skills/master-agent-orchestrator/SKILL.md`

```markdown
---
name: master-agent-orchestrator
description: >-
  Orchestrates Cursor master agents that spawn child Task sub-agents (Composer
  2.5), monitors health/connectivity, surfaces status for web/mobile UI, and
  triggers notifications when alert conditions hit. Use for multi-step ANI Stock
  workflows, parallel web+mobile+backend work, or sub-agent fleet management.
---

# Master Agent Orchestrator

> Master plans and synthesizes; **children execute** with 5-layer briefs from `context-engineering-subagents`. Default child model: **`composer-2.5-fast`**.

## When to use

- User asks for master + sub-agents, parallel implementation, or full-stack fix
- Work spans web + mobile + backend + tests + deploy
- Need health checks before/after changes on this VPS (`/opt/ani-stock`)

## Required workflow

```
- [ ] 1. Restate goal + acceptance criteria (one paragraph)
- [ ] 2. Decompose into subtasks → assign subagent_type per child
- [ ] 3. Generate brief per child (context-engineering-subagents skill)
- [ ] 4. Run scripts/check-fleet-health.sh (baseline connectivity)
- [ ] 5. Launch parallel Task children (same message, multiple tool calls)
- [ ] 6. Poll health if long-running; record status table for user
- [ ] 7. Merge child summaries; fix gaps yourself or spawn follow-up children
- [ ] 8. Every fix → regression test (fix-regression-guard)
- [ ] 9. Run test:ci (web/mobile/backend as touched)
- [ ] 10. Deploy if requested (vps-restart / skillhelp)
- [ ] 11. Emit user-visible status + notifications when conditions met
```

## Spawning child sub-agents (Cursor Task tool)

**Rules:**

| Rule | Value |
|------|--------|
| Default model | `composer-2.5-fast` |
| Parallel | Independent subtasks in **one** parent message (multiple Task calls) |
| Brief | Full 5-layer context in `prompt` — children have **no** parent chat history |
| Readonly | `explore`, `bugbot`, `security-review` → `readonly: true` |
| Writes | `generalPurpose`, `shell` for implementation and tests |

**Example (launch two children in parallel):**

```
Task: subagent_type=explore, model=composer-2.5-fast, readonly=true
  prompt: <full brief for "map watchlist mutation flow on web">

Task: subagent_type=generalPurpose, model=composer-2.5-fast
  prompt: <full brief for "add regression test for watchlistPageMutation">
```

**Do not** return only the child summary to the user when multiple children ran — synthesize conflicts and list what shipped.

## Subagent type picker

| Need | subagent_type |
|------|----------------|
| Find files, APIs, patterns | `explore` |
| Run tests, build, git, deploy | `shell` |
| Implement fix across files | `generalPurpose` |
| PR-style review | `bugbot` |
| Security pass | `security-review` |
| CI failure on a PR | `ci-investigator` |

## Health & connectivity (this server)

Run before and after substantive work:

```bash
.cursor/skills/master-agent-orchestrator/scripts/check-fleet-health.sh
```

| Check | Endpoint / command |
|-------|-------------------|
| API up | `GET /api/system/status` |
| Readiness | `GET /api/system/readiness` |
| Orchestrator WS | `status.orchestrator.websocket_connected` |
| Indicator subagents | `GET /api/advisor/signals/orchestrator/status` |
| Web build | `curl -sSI https://www.aycindustries.com/` |
| Backend service | `systemctl is-active ani-backend` |

**Display status to user** as a compact table:

```markdown
| Component | Status | Detail |
|-----------|--------|--------|
| Backend API | ok/degraded/down | mode, ws |
| Subagents (14) | listed | names from orchestrator status |
| Web | ok | HTTP 200 |
| Tests | pass/fail | test:ci summary |
```

## Notifications (web + mobile when conditions hit)

When a child or health check identifies a **user-facing condition**, route alerts through existing channels — do not invent a new bus unless implementing one.

| Condition | Web | Mobile |
|-----------|-----|--------|
| New advisor / live signal | `useNotificationInbox` + alerts APIs | `useNotificationInbox` + `notifyNewSignals` |
| Price alert triggered | `checkPriceAlerts` / price alert APIs | same pattern in mobile hooks |
| Admin / system event | `fetchAdminNotifications` | `authService.fetchAdminNotifications` |
| Orchestrator disconnected during market | Dashboard market mode banner via `/system/status` | `ensureMarketSession` + poll policy |

**Implementation pattern for new conditions:**

1. Add pure evaluator in `src/utils/` or `backend_stockdashboard/app/` (testable)
2. Unit test the evaluator (required)
3. Wire web hook (`useNotificationInbox` or page-level effect)
4. Wire mobile hook parity (`mobile_isolated/src/hooks/`)
5. Document threshold in child brief Constraint layer

See [notifications.md](notifications.md).

## Regression gate (mandatory for fixes)

Read `.cursor/skills/fix-regression-guard/SKILL.md`. Master agent **rejects done** until:

- `npm run test:ci` (web and/or mobile if touched)
- `pytest` (backend if touched)
- New test would fail on pre-fix behavior

## Anti-patterns

- One mega-prompt to a single child covering web + mobile + backend
- Skipping health check after deploy
- Child returns 50k tokens of logs to parent — demand summarized Return format
- Fixing without tests
- Spawning browser MCP for code-only tasks

## Related skills

- `.cursor/skills/context-engineering-subagents/SKILL.md`
- `.cursor/skills/fix-regression-guard/SKILL.md`
- `.cursor/skills/vps-restart/SKILL.md` — web deploy
- `.cursor/skills/skillhelp/SKILL.md` — mobile APK
```


---

# Supplement: master-agent-orchestrator/notifications.md

**Install path:** `stockdashboard/.cursor/skills/master-agent-orchestrator/notifications.md`

```markdown
# Master Agent — Notification Wiring (ANI Stock)

## Existing surfaces

### Web (`stockdashboard/src/`)

| Mechanism | Location |
|-----------|----------|
| Inbox merge (live, special, price, admin, table) | `hooks/useNotificationInbox.js` |
| Price alerts | `api/priceAlerts.js` + watchlist pages |
| Admin notifications | `api/auth.js` → `/auth/admin/notifications` |
| Market / orchestrator mode | `utils/marketSession.js` + `DashboardPage.js` |

### Mobile (`mobile_isolated/src/`)

| Mechanism | Location |
|-----------|----------|
| Inbox | `hooks/useNotificationInbox.js` |
| Android system notifications | `core/utils/signalNotifications.js` |
| Admin notifications | `core/api/services/authService.js` |

### Backend

| Mechanism | Location |
|-----------|----------|
| System status | `GET /api/system/status` |
| Orchestrator + subagent list | `GET /api/advisor/signals/orchestrator/status` |
| Telegram / WhatsApp (ops) | `app/notifications/` |

## Condition → action template

When adding a new automated notification:

```javascript
// 1. Pure evaluator (test this)
export function shouldNotifyOrchestratorDown({ websocketConnected, marketOpen }) {
  return marketOpen && websocketConnected === false;
}

// 2. Web: surface in UI + inbox section
// 3. Mobile: parallel hook + optional SignalNotification.show
// 4. Test: __tests__/orchestratorNotify.test.js
```

## Dual-delivery checklist

```
- [ ] Evaluator has unit test with good/bad cases
- [ ] Web shows banner or inbox row without hard refresh
- [ ] Mobile shows inbox + native notification when app backgrounded
- [ ] Condition documented in sub-agent Constraint context
- [ ] No duplicate spam (debounce / digest — see liveAlertsDigest.js)
```
```


---

# Supplement: master-agent-orchestrator/examples/watchlist-fix-briefs.md

**Install path:** `stockdashboard/.cursor/skills/master-agent-orchestrator/examples/watchlist-fix-briefs.md`

```markdown
# Example: LT/ST watchlist fix — child briefs

**Master goal:** Add/delete on LT and ST watchlists updates UI immediately without hard refresh.

---

## Child A — explore (readonly)

```
<identity_context>
Senior frontend engineer specializing in React data-fetching and cache races.
</identity_context>

<world_context>
Repo: /opt/ani-stock/stockdashboard
Pages: LongTermPage.js, ShortTermPage.js
API: fetchWatchlist, pageDataCache sessionStorage
</world_context>

<task_context>
Trace add/delete handlers through load(), polling, and cache keys.
Return root cause of stale rows after mutation.
</task_context>

<example_context>
Good: identifies poll re-hydrating stale cache
Bad: generic "cache might be wrong" without file:line
</example_context>

<constraint_context>
Readonly. No edits. Return ≤ 15 bullets.
</constraint_context>
```

---

## Child B — generalPurpose (implementation)

```
<identity_context>
Senior full-stack engineer on ANI Stock web dashboard.
</identity_context>

<world_context>
Fix applies to both /long-term and /short-term routes.
Users bulk-delete via checked rows (see screenshot pattern).
</world_context>

<task_context>
Implement optimistic mutation + cache persist + silent poll.
Add watchlistPageMutation.test.js regression tests.
Done when: npm run test:ci passes.
</task_context>

<example_context>
Good: computeOptimisticWatchlistMutation + resolveWatchlistRowsAfterFetch
Bad: only clearPageCache on forceRefresh without optimistic write
</example_context>

<constraint_context>
- Read fix-regression-guard skill
- Bump cache keys if shape changes
- Deploy: npm run build && rsync to /var/www/ani-stock/
</constraint_context>
```
```


---

# Script: master-agent-orchestrator/scripts/check-fleet-health.sh

**Install path:** `stockdashboard/.cursor/skills/master-agent-orchestrator/scripts/check-fleet-health.sh`

```bash
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
```


---

# Skill: context-engineering-subagents

**Install path:** `stockdashboard/.cursor/skills/context-engineering-subagents/SKILL.md`

```markdown
---
name: context-engineering-subagents
description: >-
  Generates minimal high-signal context packages for Cursor child sub-agents
  using the 5-layer model (Identity, World, Task, Example, Constraint). Use
  when spawning Task subagents, writing sub-agent prompts, decomposing workflows,
  or applying context engineering from promptingguide.ai / Anthropic agent guides.
---

# Context Engineering for Sub-Agents

> Curate the **smallest set of high-signal tokens** that maximize success (Anthropic context engineering). Each child sub-agent gets its own brief — never paste the master plan wholesale.

Read [reference.md](reference.md) for source links. Use [templates/subagent-brief.md](templates/subagent-brief.md) as the output skeleton.

## When to use

- Before launching any `Task` subagent (explore, shell, generalPurpose, bugbot, etc.)
- When a workflow needs parallel specialists (web, mobile, backend, tests, deploy)
- When a sub-agent keeps failing from missing audience, examples, or boundaries

## The 5 layers (required)

| Layer | Question | Put here |
|-------|----------|----------|
| **Identity** | Who is the AI acting as? | Role, seniority, stack expertise, what it must **not** pretend to know |
| **World** | What situation / audience / repo context? | ANI Stock paths, user tier, market session, affected surface (web/mobile/API) |
| **Task** | What exactly must happen? | One measurable outcome, inputs, done criteria |
| **Example** | What does good/bad output look like? | 1 good snippet + 1 anti-pattern (few-shot, not a laundry list) |
| **Constraint** | Boundaries and non-negotiables? | Files to touch, tests required, no force-push, cache keys, model/runtime |

## Generation workflow

```
- [ ] 1. State the master goal in one sentence
- [ ] 2. Split into independent subtasks (parallel when safe)
- [ ] 3. For each subtask, fill all 5 layers in templates/subagent-brief.md
- [ ] 4. Strip master-only context (other subtasks, full chat history)
- [ ] 5. Add just-in-time pointers (file paths, API routes) — not whole files
- [ ] 6. Run scripts/validate-context-package.sh on the brief
- [ ] 7. Pass brief as the Task `prompt` body
```

## ANI Stock defaults (World layer)

| Surface | Root | Test gate |
|---------|------|-----------|
| Web | `stockdashboard/src/` | `cd stockdashboard && npm run test:ci` |
| Mobile | `stockdashboard/mobile_isolated/` | `cd stockdashboard/mobile_isolated && npm run test:ci` |
| Backend | `backend_stockdashboard/` | `cd backend_stockdashboard && pytest` |

**Regression rule:** Every behavioral fix → unit test. Read `.cursor/skills/fix-regression-guard/SKILL.md`.

## Sub-agent prompt shape

Use XML-style sections (models parse reliably):

```markdown
<identity_context>
You are a senior [web|mobile|backend] engineer on ANI Stock...
</identity_context>

<world_context>
Repo: /opt/ani-stock/stockdashboard
Surface: Short Term watchlist (web)
Audience: authenticated premium users during NSE session
</world_context>

<task_context>
Implement X so Y happens without hard refresh.
Done when: Z passes in test:ci
</task_context>

<example_context>
Good: optimistic setData + page cache persist before network refresh
Bad: await load() that clears cache then poll restores deleted rows
</example_context>

<constraint_context>
- Minimal diff; match existing patterns in LongTermPage.js
- Add regression test in src/utils/*.test.js
- Do not commit secrets; do not force-push main
</constraint_context>
```

## Context budget rules

1. **One task per sub-agent** — if you need "and also refactor auth", spawn another child.
2. **Return summaries** — child returns 1–2k token digest; master keeps details out of parent context (Anthropic sub-agent pattern).
3. **Tools** — list only tools the child needs (e.g. explore → read-only; shell → test commands).
4. **No stale time rules** — use "check `marketSession.js`" not hard-coded dates.

## Validation

```bash
.cursor/skills/context-engineering-subagents/scripts/validate-context-package.sh path/to/brief.md
```

## Handoff to master orchestrator

After briefs are ready, use `.cursor/skills/master-agent-orchestrator/SKILL.md` to launch children with `model: composer-2.5-fast` (or user-specified Composer 2.5 slug).
```


---

# Supplement: context-engineering-subagents/reference.md

**Install path:** `stockdashboard/.cursor/skills/context-engineering-subagents/reference.md`

```markdown
# Context Engineering References

## Primary sources

- [Prompting Guide — Context Engineering Guide](https://www.promptingguide.ai/guides/context-engineering-guide)
- [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

## Key principles (synthesized)

1. **Context > prompt wording** — optimize the full token window (system, tools, examples, history), not only the user message.
2. **Finite attention** — prefer minimal high-signal context; filter noise aggressively.
3. **Sub-agents** — parallel specialists with clean windows; parent receives condensed summaries only.
4. **Just-in-time retrieval** — pass file paths and API routes; let children read what they need.
5. **Compaction** — for long runs, summarize completed subtasks before spawning the next wave.

## ANI Stock skills chain

| Skill | Role |
|-------|------|
| `context-engineering-subagents` | Build child briefs (5 layers) |
| `master-agent-orchestrator` | Spawn/monitor children, health, notifications |
| `fix-regression-guard` | Tests + CI for every fix |
| `web-mutation-refresh-guard` | Web mutation/cache patterns |
| `mobile-regression-guard` | Mobile Jest + lint gates |
```


---

# Template: context-engineering-subagents/templates/subagent-brief.md

**Install path:** `stockdashboard/.cursor/skills/context-engineering-subagents/templates/subagent-brief.md`

```markdown
# Sub-Agent Brief — {{SUBAGENT_ID}}

**Master goal:** {{MASTER_GOAL_ONE_LINE}}  
**Child scope:** {{CHILD_SCOPE_ONE_LINE}}  
**Model:** composer-2.5-fast (default)  
**Subagent type:** {{explore|shell|generalPurpose|bugbot|security-review}}

---

## Identity Context

Who is the AI acting as?

```
{{ROLE_AND_EXPERTISE}}
```

---

## World Context

What does the AI need to know about situation, business, audience, repo?

```
{{REPO_PATHS}}
{{AFFECTED_USERS_OR_TIERS}}
{{RELATED_FILES_AND_APIS}}
```

---

## Task Context

What exactly needs to happen? What is done?

```
Objective: {{OBJECTIVE}}
Inputs: {{INPUTS}}
Done when: {{ACCEPTANCE_CRITERIA}}
```

---

## Example Context

What does great output look like? What should be avoided?

**Good:**
```
{{GOOD_EXAMPLE}}
```

**Bad:**
```
{{BAD_EXAMPLE}}
```

---

## Constraint Context

Boundaries, rules, non-negotiables.

```
- Touch only: {{FILE_GLOB_OR_PATHS}}
- Tests: {{TEST_COMMAND_AND_FILE}}
- Never: {{FORBIDDEN_ACTIONS}}
- Cache/version bumps: {{IF_APPLICABLE}}
```

---

## Return format (child → master)

```markdown
## Status
success | blocked | partial

## Summary
(≤ 8 bullets)

## Files changed
- path — why

## Tests run
command + result

## Blockers
(none or explicit)
```
```


---

# Script: context-engineering-subagents/scripts/validate-context-package.sh

**Install path:** `stockdashboard/.cursor/skills/context-engineering-subagents/scripts/validate-context-package.sh`

```bash
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
```


---

# Skill: web-mutation-refresh-guard

**Install path:** `stockdashboard/.cursor/skills/web-mutation-refresh-guard/SKILL.md`

```markdown
---
name: web-mutation-refresh-guard
description: >-
  Guards web dashboard fixes where admin tier moves or LT/ST watchlist adds must
  update UI immediately without hard refresh. Requires regression tests in
  src/utils and src/api. Use when fixing admin user directory, watchlist
  add/remove, stale GET cache, optimistic UI, or tier scroll/highlight after
  mutations on stockdashboard (web).
---

# Web Mutation Refresh Guard

> **All web fixes** require a regression unit test (see **`.cursor/skills/fix-regression-guard/SKILL.md`**). This skill adds **extra** requirements for **admin tier actions** and **LT/ST watchlist mutations**.

Read the global skill first (reproduce → fix → test → CI). Mobile parity: **`.cursor/skills/mobile-regression-guard/SKILL.md`**.

## When this skill applies

| Symptom | Area |
|---------|------|
| User stays in wrong admin table until hard refresh | Admin directory |
| Grant monthly/yearly/lifetime does not scroll/highlight | Admin directory |
| Added stock missing from LT/ST until hard refresh | Watchlist pages |
| Poll/background load overwrites fresh mutation | Watchlist `loadGenRef` |

## Required implementation patterns (web)

### Admin user directory

1. **Fresh reload** — use `fetchFreshAdminUsers()` from `src/utils/adminUsersReload.js` (clears `clearApiGetCache` + `skipCache: true`).
2. **Silent post-mutation reload** — `loadUsers({ silent: true })` so tables stay mounted.
3. **Tier classification** — import from `src/utils/adminUserTiers.js` (`tierForUser`, `isMonthlyPremiumUser`, etc.).
4. **Focus after action** — `onUserActionComplete` → `focusUserInDirectory(userId, nextRows, hintTier)`; scroll via `adminTierSectionId(tier)`.
5. **Section ids** — `admin-tier-lifetime`, `admin-tier-monthly`, `admin-tier-yearly`, `admin-tier-basic` on tier `<Box>` wrappers.

### LT / ST watchlist (`LongTermPage.js`, `ShortTermPage.js`)

1. **Optimistic rows** — `applyWatchlistRowMutation(prev, { added, removed })` from `src/utils/watchlistLocalMutation.js` before network refresh.
2. **Force refresh** — `load({ forceRefresh: true })` clears page cache + API GET cache; `fetchWatchlist(..., { skipCache: true })`.
3. **Mutation API cache** — `addToWatchlist` / `removeFromWatchlist` / `bulkDeleteFromWatchlist` call `clearApiGetCache()` in `src/api/watchlist.js`.
4. **Race guard** — `loadGenRef` in page `load()`; ignore stale responses when `gen !== loadGenRef.current`.
5. **Cache keys** — bump `LONG_TERM_CACHE_KEY` / `SHORT_TERM_CACHE_KEY` version when changing cache shape.

## Required regression tests

Add or extend tests **in the same PR** as the fix:

| Guard | Test file | What it asserts |
|-------|-----------|-----------------|
| Admin tier buckets | `src/utils/adminUserTiers.test.js` | `tierForUser` for lifetime / monthly / yearly / basic |
| Watchlist optimistic UI | `src/utils/watchlistLocalMutation.test.js` | `applyWatchlistRowMutation` add/remove without duplicate |
| Watchlist poll/cache race | `src/utils/watchlistPageMutation.test.js` | optimistic persist + load generation bump |
| API cache bust | `src/api/mutationCache.test.js` | `clearApiGetCache` on watchlist mutations; `fetchFreshAdminUsers` uses `skipCache` |

**Do not** ship admin/watchlist mutation fixes without at least one new or updated test in the table above.

## Run tests (web)

```bash
cd stockdashboard
npm run test:ci
```

All tests must pass before `npm run build` and VPS deploy (see `vps-restart` skill).

## Checklist (copy per fix)

```
- [ ] Root cause documented (stale GET cache / missing optimistic update / race)
- [ ] Fix uses shared util (adminUserTiers, watchlistLocalMutation, adminUsersReload) when applicable
- [ ] Regression test added/updated in mapped test file
- [ ] npm run test:ci green
- [ ] Cache key bumped if sessionStorage/GET cache can mask fix
- [ ] Mobile parity checked (mobile_isolated WatchlistSection / AdminScreen) if same bug exists on app
```

## Anti-patterns

- `fetchAdminUsers()` without `skipCache` after tier mutation
- `load()` after add without `forceRefresh` or optimistic `setData`
- Duplicating tier logic in page files instead of `adminUserTiers.js`
- Fixing web only with no regression test
- Relying on manual hard-refresh QA

## Related skills

- `.cursor/skills/fix-regression-guard/SKILL.md` — global test + CI gate
- `.cursor/skills/vps-restart/SKILL.md` — deploy web build after tests pass
```


---

# Skill: mobile-regression-guard

**Install path:** `stockdashboard/.cursor/skills/mobile-regression-guard/SKILL.md`

```markdown
---
name: mobile-regression-guard
description: >-
  Ensures every mobile (React Native) fix ships with an enabled Jest regression
  test and passes test:ci before APK publish. Use for any mobile_isolated bug
  fix, cache policy, watchlist, admin, signals, advisor, or dashboard change.
---

# Mobile Regression Guard

> **Every mobile fix** must include an enabled unit test in `mobile_isolated/__tests__/` and pass `npm run test:ci` before APK build or publish.

Read **`.cursor/skills/fix-regression-guard/SKILL.md`** first (universal web + mobile rules).

## Required workflow

```
- [ ] 1. Reproduce on device or simulator (symptom + root cause)
- [ ] 2. Minimal fix in mobile_isolated/src/
- [ ] 3. Add/update test in __tests__/ (same PR/commit)
- [ ] 4. npm run test:ci — lint + unit tests green (includes `lint:ci`)
- [ ] 5. npm run typecheck — pass (before APK)
- [ ] 6. Bump MOBILE_PAGE_CACHE_KEYS version if stale AsyncStorage can mask fix
- [ ] 7. Publish only via skillhelp after steps 4–5 (if releasing APK)
```

## Where to put tests

| Area changed | Preferred test file |
|--------------|---------------------|
| `watchlistService.js` | `__tests__/watchlistService.test.js` |
| `dashboardCachePolicy.js` | `__tests__/dashboardCachePolicy.test.js` |
| `pageCache.js` / hydration | `__tests__/pageCache.test.js`, `pageCacheHydration.test.js` |
| Signals / inbox merge | `__tests__/signalsTabPayload.test.js`, `alertInboxReadState.test.js` |
| Advisor trend/chart | `__tests__/fetchAdvisorTrendPayload.test.js`, `advisorHubCache.test.js` |
| New pure util | `__tests__/<moduleName>.test.js` (new file) |

Extract pure logic from screens into `src/core/utils/` or `src/core/api/services/` when the screen is hard to test.

## Area patterns (regression targets)

### Watchlist add/remove (`WatchlistSection.js`, `watchlistService.js`)

- Clear page cache on mutation (`clearPageCache` in service)
- Optimistic row update before refetch
- `loadGenRef` / `cacheBust` on force reload
- Test: `watchlistService.test.js` asserts POST/DELETE + cache clear

### Admin tier actions (`AdminScreen.js`, `authService.js`)

- `fetchAdminUsers(..., { cacheBust: true })` after mutations
- Tier sections + scroll/highlight after action
- Test: service mocks + tier helpers if extracted

### Dashboard / cache / pull-to-refresh

- `applyPullRefreshPolicy`, `dashboardSectionsToRefresh`
- Test: `dashboardCachePolicy.test.js`

### Signals / notifications

- Merged live alerts, inbox cache-first load
- Test: dedicated payload util tests

## Commands

```bash
cd /opt/ani-stock/stockdashboard/mobile_isolated
npm run test:ci   # runs lint:ci then jest
npm run lint:ci   # ESLint errors only (src, __tests__, scripts)
npm run typecheck
```

`__tests__/eslintQualityGate.test.js` fails if any ESLint **error** is introduced under `src/` or `__tests__/`, including `react-hooks/exhaustive-deps` in `src/hooks/`.

## Publish gate

**Never** run `android:apk:release` or `publish-release-apk.sh` until `test:ci` passes.

See **`.cursor/skills/skillhelp/SKILL.md`**.

## Anti-patterns

- Mobile-only fix with no `__tests__` update
- Skipping tests to ship APK faster
- Bumping UI without bumping cache key when AsyncStorage hides the fix
- Duplicating web logic without parity tests on shared behavior

## Related

- `.cursor/skills/fix-regression-guard/SKILL.md` — universal rule
- `.cursor/skills/web-mutation-refresh-guard/SKILL.md` — web parity for watchlist/admin
```


---

# Skill: skillhelp

**Install path:** `stockdashboard/.cursor/skills/skillhelp/SKILL.md`

```markdown
---
name: skillhelp
description: >-
  Runs mobile unit tests, builds, publishes, and enables the ANI Stock Android
  release APK for end-user download at
  https://www.aycindustries.com/mobile/ani-stock-release.apk. Use when the user
  mentions /skillhelp, mobile APK release, side-load APK, publish
  ani-stock-release.apk, mobile-artifacts, DOWNLOAD.json, or enabling the public
  mobile download URL on the VPS.
---

# ANI Stock mobile APK — test, build, copy, enable download

End users install from:

**https://www.aycindustries.com/mobile/ani-stock-release.apk**

In-app update manifest:

**https://www.aycindustries.com/mobile/DOWNLOAD.json**

## Paths (VPS)

| Role | Path |
|------|------|
| Mobile source | `/opt/ani-stock/stockdashboard/mobile_isolated` |
| Gradle release output | `mobile_isolated/android/app/build/outputs/apk/release/app-release.apk` |
| **Public artifact** (Nginx serves this) | `/opt/ani-stock/mobile-artifacts/ani-stock-release.apk` |
| Versioned archive | `mobile_isolated/mobile/ani-stock-release-v{VERSION}.apk` |
| Update manifest | `/opt/ani-stock/mobile-artifacts/DOWNLOAD.json` |

Nginx aliases `/mobile/ani-stock-release.apk` → `mobile-artifacts/ani-stock-release.apk` (no copy to `/var/www/ani-stock`).

## Required order (do not skip steps)

**All unit tests must pass before generating the APK.** This is required by **`.cursor/skills/fix-regression-guard/SKILL.md`** and **`.cursor/skills/mobile-regression-guard/SKILL.md`**: every fix must have a regression test; `test:ci` is the publish gate. If tests fail, fix them and re-run — do not publish.

### Preferred: one script

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/skillhelp/scripts/publish-release-apk.sh "Release notes"
```

Steps inside the script:

1. `npm run typecheck`
2. `npm run test:ci` — **gate**; abort on failure
3. `npm run android:apk:release`
4. Copy APK to public + versioned paths (below)
5. `sync-download-manifest.sh` → updates `DOWNLOAD.json`

### Manual steps (same order)

```bash
cd /opt/ani-stock/stockdashboard/mobile_isolated

npm run typecheck
npm run test:ci

npm run android:apk:release 2>&1 | tail -6
```

Copy so end users can download (use `package.json` version **before** manifest bump):

```bash
VERSION=$(node -p "require('/opt/ani-stock/stockdashboard/mobile_isolated/package.json').version")
mkdir -p /opt/ani-stock/stockdashboard/mobile_isolated/mobile
cp -f /opt/ani-stock/stockdashboard/mobile_isolated/android/app/build/outputs/apk/release/app-release.apk \
  "/opt/ani-stock/stockdashboard/mobile_isolated/mobile/ani-stock-release-v${VERSION}.apk"
cp -f /opt/ani-stock/stockdashboard/mobile_isolated/android/app/build/outputs/apk/release/app-release.apk \
  /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
sha256sum /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
stat -c '%s' /opt/ani-stock/mobile-artifacts/ani-stock-release.apk

./scripts/sync-download-manifest.sh "Release notes here"
```

## Verify public download

```bash
curl -sSI https://www.aycindustries.com/mobile/ani-stock-release.apk | head -5
curl -sS https://www.aycindustries.com/mobile/DOWNLOAD.json | python3 -m json.tool | head -12
```

Expect HTTP 200; `Content-Length` must match `sizeBytes` in `DOWNLOAD.json`.

## Version sync

Before release, align `package.json`, `android/app/build.gradle`, and `src/core/config/appVersion.js`. `sync-download-manifest.sh` bumps source for the **next** cycle after publishing.

## Checklist

```
- [ ] npm run typecheck — pass
- [ ] npm run test:ci — all unit tests pass (required before APK)
- [ ] npm run android:apk:release — BUILD SUCCESSFUL
- [ ] cp → /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
- [ ] cp → mobile_isolated/mobile/ani-stock-release-v{VERSION}.apk
- [ ] sync-download-manifest.sh — sha256/size/version match
- [ ] https://www.aycindustries.com/mobile/ani-stock-release.apk — HTTP 200
```

## Related

- [scripts/publish-release-apk.sh](scripts/publish-release-apk.sh)
- `docs/deployment/deploy_mobile_android.sh` (full pipeline incl. lint + AAB)
- `docs/deployment/MOBILE_ANDROID_PLAY_STORE.md`
```


---

# Script: skillhelp/scripts/publish-release-apk.sh

**Install path:** `stockdashboard/.cursor/skills/skillhelp/scripts/publish-release-apk.sh`

```bash
#!/usr/bin/env bash
# Run unit tests, build release APK, copy to public paths for end-user download.
# Usage: ./scripts/publish-release-apk.sh ["Optional release notes"]
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
MOBILE_DIR="${APP_ROOT}/stockdashboard/mobile_isolated"
ARTIFACT_DIR="${ARTIFACT_DIR:-${APP_ROOT}/mobile-artifacts}"
RELEASE_APK="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
NOTES="${1:-}"

cd "$MOBILE_DIR"

echo "[1/5] Typecheck..."
npm run typecheck

echo "[2/5] Unit tests (CI gate — must pass before APK)..."
npm run test:ci

echo "[3/5] Build release APK..."
npm run android:apk:release 2>&1 | tail -6

if [[ ! -f "$RELEASE_APK" ]]; then
  echo "ERROR: Release APK not found at $RELEASE_APK"
  exit 1
fi

VERSION=$(node -p "require('$MOBILE_DIR/package.json').version")
VERSIONED_DIR="$MOBILE_DIR/mobile"
mkdir -p "$VERSIONED_DIR" "$ARTIFACT_DIR"

echo "[4/5] Copy to versioned + public download paths..."
cp -f "$RELEASE_APK" "$VERSIONED_DIR/ani-stock-release-v${VERSION}.apk"
cp -f "$RELEASE_APK" "$ARTIFACT_DIR/ani-stock-release.apk"
sha256sum "$ARTIFACT_DIR/ani-stock-release.apk"
stat -c '%s' "$ARTIFACT_DIR/ani-stock-release.apk"

echo "[5/5] Sync DOWNLOAD.json..."
"$MOBILE_DIR/scripts/sync-download-manifest.sh" "$NOTES"

echo ""
echo "Published v${VERSION}"
echo "  Download: https://www.aycindustries.com/mobile/ani-stock-release.apk"
echo "  Manifest: https://www.aycindustries.com/mobile/DOWNLOAD.json"
echo "  Local:    $ARTIFACT_DIR/ani-stock-release.apk"
echo "  Archive:  $VERSIONED_DIR/ani-stock-release-v${VERSION}.apk"
```


---

# Skill: vps-restart

**Install path:** `stockdashboard/.cursor/skills/vps-restart/SKILL.md`

```markdown
---
name: vps-restart
description: >-
  Restart or redeploy the ANI Stock VPS frontend and backend after code fixes.
  Use when the user asks to restart, reload, redeploy, refresh servers, apply
  fixes to production, or run deploy commands on the VPS (aycindustries.com).
  Always use the exact commands in this skill — do not substitute shortcuts.
---

# VPS restart — frontend & backend (ANI Stock)

Run these **exact** commands on the VPS when restarting after a fix or deploy.

## Frontend

```bash
cd /opt/ani-stock/stockdashboard
npm ci && npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
sudo nginx -t && sudo systemctl reload nginx
```

Run the full block when **frontend** code changed or the user asks to restart/redeploy the frontend.

## Backend

```bash
cd /opt/ani-stock/backend_stockdashboard
sudo systemctl daemon-reload && sudo systemctl restart ani-backend
```

Run when **backend** code or `.env` / unit file changed, or the user asks to restart the backend.

## Database migrations (PostgreSQL)

Always use `DATABASE_URL` from `backend_stockdashboard/.env` — do **not** hardcode `ani_stock`, `postgres`, or passwords.

```bash
cd /opt/ani-stock/backend_stockdashboard
chmod +x scripts/run_sql_migration.sh
./scripts/run_sql_migration.sh scripts/migrations/011_premium_plan.sql
```

Verify a column (optional):

```bash
cd /opt/ani-stock/backend_stockdashboard
source scripts/lib/load_dotenv.sh && load_dotenv_file .env
psql --dbname="$(psql_database_uri)" -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='app_users' AND column_name='premium_plan';"
```

## Both (typical after a full fix)

1. Backend block first (API must serve new logic).
2. Frontend block second (static assets + nginx reload).

## Verify (optional, after restart)

```bash
systemctl is-active ani-backend
curl -s -o /dev/null -w "backend=%{http_code}\n" http://127.0.0.1:8000/api/system/status
```

Tell the user to **hard-refresh** after deploy. Legacy formatted screen caches are purged automatically on first screen load.

## Mobile APK (after backend or mobile fixes)

If the change affects mobile clients (API, auth, premium, advisor, screens, or `mobile_isolated/`), also run the **`publish-mobile-apk`** skill:

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/publish-mobile-apk/scripts/publish-release-apk.sh "Release notes"
```

This updates `DOWNLOAD.json` so installed users see the **App update available** popup.

## Screen CHG% cache matrix (web + mobile)
|------|-------------|-----------------|-------------|--------|
| **Trending** | Screens → Trending | `trendingStocksData_v3_*` | `day1d` from API | Raw cache + `mapRows` |
| **Top Movers** | Screens → Price shockers | `priceShockersData_v4_*` | `day1d` / `week1w` / `month1m` | Raw cache + `mapRows` |
| **Volume Movers** | Screens → Volume shockers | `volumeShockersData_v5_*` | price + volume % | Raw cache + `mapRows` |
| **Alpha Tracker** | Screens → Relative performance | `relativePerformanceData_v3_*` | horizon field + RS% | Raw cache + `mapRows` |
| **Dashboard** | Overview movers / trending strip | `dashboard_overview_cache_v5` | fresh API on load | Raw fetch + map |
| **Sector outlook** | Markets → Sector | `sectorOutlookData` | sector % columns | Not stock `day1d` — OK |
| **Sub-sector popup** | Sub-sector modal | server-side | EOD candles | Backend `subsector-outlook` |
| **Trend reversal** | Advisor tab | `trend_reversal_*` | `chg_pct` from advisor API | Different pipeline |
| **Mobile Screens hub** | All screen tabs | `screens-v5-*` | `stockRowPct()` at render | Already raw API rows |
| **Mobile dashboard** | Home | `dashboard-v15` | `stockRowPct()` at render | Cache bump |

## Notes

- Nginx may also serve from `/opt/ani-stock/stockdashboard/build` depending on vhost; `npm run build` updates that path. Keep **rsync to `/var/www/ani-stock/`** as part of the standard workflow.
- Do not skip `npm ci` before `npm run build` on VPS deploys.
- Do not use `systemctl restart ani-backend` without `daemon-reload` when unit files may have changed.
```


---

# Skill: publish-mobile-apk

**Install path:** `stockdashboard/.cursor/skills/publish-mobile-apk/SKILL.md`

```markdown
---
name: publish-mobile-apk
description: >-
  Builds and publishes the ANI Stock Android release APK after backend or
  mobile-impacting changes so installed users see the in-app update popup.
  Use when backend API/auth/premium fixes ship, mobile JS changes, the user
  asks to build or publish APK, bump mobile version, update DOWNLOAD.json,
  or enable the public download at aycindustries.com/mobile.
---

# Publish mobile APK (after backend / mobile fixes)

When **backend** or **mobile** changes affect what users see in the app, finish with a **published APK** and an updated **`DOWNLOAD.json`**. Installed builds compare `versionCode` in `DOWNLOAD.json` to the installed APK; when the server is higher, `useAppUpdatePrompt` shows **“App update available”**.

## When to run this skill

Run after **any** of these:

- Backend API / auth / premium / advisor / screens changes that mobile calls
- Mobile JS changes under `stockdashboard/mobile_isolated/`
- User asks to publish APK, bump version, or fix the update popup
- Full VPS deploy that included backend fixes users need on mobile

**Order:** deploy backend (and web if needed) **first**, then publish APK.

### Backend + web restart (do this before APK)

```bash
cd /opt/ani-stock/backend_stockdashboard
sudo systemctl daemon-reload && sudo systemctl restart ani-backend

cd /opt/ani-stock/stockdashboard
npm ci && npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
sudo nginx -t && sudo systemctl reload nginx
```

Skip the web block if only backend + APK changed.

## Paths (VPS)

| Role | Path |
|------|------|
| Mobile source | `/opt/ani-stock/stockdashboard/mobile_isolated` |
| Gradle release APK | `mobile_isolated/android/app/build/outputs/apk/release/app-release.apk` |
| **Public download** (Nginx) | `/opt/ani-stock/mobile-artifacts/ani-stock-release.apk` |
| Update manifest | `/opt/ani-stock/mobile-artifacts/DOWNLOAD.json` |
| Versioned archive | `mobile_isolated/mobile/ani-stock-release-v{VERSION}.apk` |

Public URLs:

- APK: `https://www.aycindustries.com/mobile/ani-stock-release.apk`
- Manifest: `https://www.aycindustries.com/mobile/DOWNLOAD.json`

Nginx serves `/mobile/*` from `mobile-artifacts/` — **no** rsync to `/var/www/ani-stock` for the APK.

## Version files (must match before build)

Align these **before** `android:apk:release`:

| File | Fields |
|------|--------|
| `mobile_isolated/package.json` | `version` (e.g. `1.2.51`) |
| `mobile_isolated/android/app/build.gradle` | `versionCode` (integer), `versionName` |
| `mobile_isolated/src/core/config/appVersion.js` | `APP_VERSION_NAME`, `APP_VERSION_CODE` |

`sync-download-manifest.sh` writes `DOWNLOAD.json` with the **built** version, then runs `bump-mobile-version.js` to bump source for the **next** cycle.

**Update popup rule:** published `versionCode` in `DOWNLOAD.json` must be **greater than** the installed APK’s `versionCode`.

## Preferred: one script (tests → build → publish)

```bash
/opt/ani-stock/stockdashboard/.cursor/skills/publish-mobile-apk/scripts/publish-release-apk.sh "Short release notes for the update popup"
```

Steps inside:

1. `npm run typecheck`
2. `npm run test:ci` — **must pass**; do not publish on failure
3. `npm run android:apk:release`
4. Copy APK to `mobile-artifacts/` + versioned archive
5. `./scripts/sync-download-manifest.sh` → updates `DOWNLOAD.json`

## Manual steps (same order)

```bash
cd /opt/ani-stock/stockdashboard/mobile_isolated

npm run typecheck
npm run test:ci

npm run android:apk:release 2>&1 | tail -6
```

Copy artifacts (use `package.json` version **before** manifest bump):

```bash
VERSION=$(node -p "require('/opt/ani-stock/stockdashboard/mobile_isolated/package.json').version")
mkdir -p /opt/ani-stock/stockdashboard/mobile_isolated/mobile
cp -f /opt/ani-stock/stockdashboard/mobile_isolated/android/app/build/outputs/apk/release/app-release.apk \
  "/opt/ani-stock/stockdashboard/mobile_isolated/mobile/ani-stock-release-v${VERSION}.apk"
cp -f /opt/ani-stock/stockdashboard/mobile_isolated/android/app/build/outputs/apk/release/app-release.apk \
  /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
sha256sum /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
stat -c '%s' /opt/ani-stock/mobile-artifacts/ani-stock-release.apk

./scripts/sync-download-manifest.sh "Short release notes for the update popup"
```

## Full pipeline (APK + Play Store AAB)

```bash
chmod +x /opt/ani-stock/stockdashboard/docs/deployment/deploy_mobile_android.sh
/opt/ani-stock/stockdashboard/docs/deployment/deploy_mobile_android.sh
```

Requires `ANDROID_HOME`, Java, and optionally `ANI_UPLOAD_*` in `~/.gradle/gradle.properties` for release signing.

## Verify publish + update popup

```bash
curl -sSI https://www.aycindustries.com/mobile/ani-stock-release.apk | head -5
curl -sS https://www.aycindustries.com/mobile/DOWNLOAD.json | python3 -m json.tool | head -12
```

Expect HTTP **200**; `Content-Length` must match `sizeBytes` in `DOWNLOAD.json`.

Installed app checks manifest on login and every **15 minutes** while active (`useAppUpdatePrompt`). Users on an older `versionCode` see **App update available** with your `releaseNotes`.

Admin → **Check auto-update** uses the same manifest for diagnostics.

## Checklist

```
- [ ] Backend restarted (if API changed)
- [ ] npm run typecheck — pass
- [ ] npm run test:ci — pass (required before APK)
- [ ] npm run android:apk:release — BUILD SUCCESSFUL
- [ ] cp → /opt/ani-stock/mobile-artifacts/ani-stock-release.apk
- [ ] sync-download-manifest.sh — versionCode/version/sha256/size updated
- [ ] curl DOWNLOAD.json — versionCode > previous publish
- [ ] Tell user: open app → update popup, or install from public APK URL
```

## Notes

- Do **not** skip `test:ci` before publishing.
- Release notes in `sync-download-manifest.sh` appear in the update popup body.
- If `DOWNLOAD.json` `versionCode` is stale vs built APK, users will not see the popup — always run `sync-download-manifest.sh` after copy.
```


---

# Script: publish-mobile-apk/scripts/publish-release-apk.sh

**Install path:** `stockdashboard/.cursor/skills/publish-mobile-apk/scripts/publish-release-apk.sh`

```bash
#!/usr/bin/env bash
# Run unit tests, build release APK, copy to public paths for end-user download.
# Usage: ./scripts/publish-release-apk.sh ["Optional release notes"]
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/ani-stock}"
MOBILE_DIR="${APP_ROOT}/stockdashboard/mobile_isolated"
ARTIFACT_DIR="${ARTIFACT_DIR:-${APP_ROOT}/mobile-artifacts}"
RELEASE_APK="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
NOTES="${1:-}"

cd "$MOBILE_DIR"

echo "[1/5] Typecheck..."
npm run typecheck

echo "[2/5] Unit tests (CI gate — must pass before APK)..."
npm run test:ci

echo "[3/5] Build release APK..."
npm run android:apk:release 2>&1 | tail -6

if [[ ! -f "$RELEASE_APK" ]]; then
  echo "ERROR: Release APK not found at $RELEASE_APK"
  exit 1
fi

VERSION=$(node -p "require('$MOBILE_DIR/package.json').version")
VERSIONED_DIR="$MOBILE_DIR/mobile"
mkdir -p "$VERSIONED_DIR" "$ARTIFACT_DIR"

echo "[4/5] Copy to versioned + public download paths..."
cp -f "$RELEASE_APK" "$VERSIONED_DIR/ani-stock-release-v${VERSION}.apk"
cp -f "$RELEASE_APK" "$ARTIFACT_DIR/ani-stock-release.apk"
sha256sum "$ARTIFACT_DIR/ani-stock-release.apk"
stat -c '%s' "$ARTIFACT_DIR/ani-stock-release.apk"

echo "[5/5] Sync DOWNLOAD.json..."
"$MOBILE_DIR/scripts/sync-download-manifest.sh" "$NOTES"

echo ""
echo "Published v${VERSION}"
echo "  Download: https://www.aycindustries.com/mobile/ani-stock-release.apk"
echo "  Manifest: https://www.aycindustries.com/mobile/DOWNLOAD.json"
echo "  Local:    $ARTIFACT_DIR/ani-stock-release.apk"
echo "  Archive:  $VERSIONED_DIR/ani-stock-release-v${VERSION}.apk"
```


# PART 4 — USER SKILLS


---

# User skill: find-docs

**Install path:** `~/.cursor/skills/find-docs/SKILL.md`

```markdown
---
name: find-docs
description: >-
  Retrieves up-to-date documentation, API references, and code examples for any
  developer technology. Use this skill whenever the user asks about a specific
  library, framework, SDK, CLI tool, or cloud service -- even for well-known ones
  like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. Your
  training data may not reflect recent API changes or version updates.

  Always use for: API syntax questions, configuration options, version migration
  issues, "how do I" questions mentioning a library name, debugging that involves
  library-specific behavior, setup instructions, and CLI tool usage.

  Use even when you think you know the answer -- do not rely on training data
  for API details, signatures, or configuration options as they are frequently
  outdated. Always verify against current docs. Prefer this over web search for
  library documentation and API details.
---

# Documentation Lookup

Retrieve current documentation and code examples for any library using the Context7 CLI.

Make sure the CLI is up to date before running commands:

```bash
npm install -g ctx7@latest
```

Or run directly without installing:

```bash
npx ctx7@latest <command>
```

## Workflow

Two-step process: resolve the library name to an ID, then query docs with that ID.

```bash
# Step 1: Resolve library ID
ctx7 library <name> <query>

# Step 2: Query documentation
ctx7 docs <libraryId> <query>
```

You MUST call `ctx7 library` first to obtain a valid library ID UNLESS the user explicitly provides a library ID in the format `/org/project` or `/org/project/version`.

IMPORTANT: Do not run these commands more than 3 times per question. If you cannot find what you need after 3 attempts, use the best result you have.

## Step 1: Resolve a Library

Resolves a package/product name to a Context7-compatible library ID and returns matching libraries.

```bash
ctx7 library react "How to clean up useEffect with async operations"
ctx7 library nextjs "How to set up app router with middleware"
ctx7 library prisma "How to define one-to-many relations with cascade delete"
```

Always pass a `query` argument — it is required and directly affects result ranking. Use the user's intent to form the query, which helps disambiguate when multiple libraries share a similar name. Do not include any sensitive or confidential information such as API keys, passwords, credentials, personal data, or proprietary code in your query.

### Result fields

Each result includes:

- **Library ID** — Context7-compatible identifier (format: `/org/project`)
- **Name** — Library or package name
- **Description** — Short summary
- **Code Snippets** — Number of available code examples
- **Source Reputation** — Authority indicator (High, Medium, Low, or Unknown)
- **Benchmark Score** — Quality indicator (100 is the highest score)
- **Versions** — List of versions if available. Use one of those versions if the user provides a version in their query. The format is `/org/project/version`.

### Selection process

1. Analyze the query to understand what library/package the user is looking for
2. Select the most relevant match based on:
   - Name similarity to the query (exact matches prioritized)
   - Description relevance to the query's intent
   - Documentation coverage (prioritize libraries with higher Code Snippet counts)
   - Source reputation (consider libraries with High or Medium reputation more authoritative)
   - Benchmark score (higher is better, 100 is the maximum)
3. If multiple good matches exist, acknowledge this but proceed with the most relevant one
4. If no good matches exist, clearly state this and suggest query refinements
5. For ambiguous queries, request clarification before proceeding with a best-guess match

### Version-specific IDs

If the user mentions a specific version, use a version-specific library ID:

```bash
# General (latest indexed)
ctx7 docs /vercel/next.js "How to set up app router"

# Version-specific
ctx7 docs /vercel/next.js/v14.3.0-canary.87 "How to set up app router"
```

The available versions are listed in the `ctx7 library` output. Use the closest match to what the user specified.

## Step 2: Query Documentation

Retrieves up-to-date documentation and code examples for the resolved library.

```bash
ctx7 docs /facebook/react "How to clean up useEffect with async operations"
ctx7 docs /vercel/next.js "How to add authentication middleware to app router"
ctx7 docs /prisma/prisma "How to define one-to-many relations with cascade delete"
```

### Writing good queries

The query directly affects the quality of results. Be specific and include relevant details. Do not include any sensitive or confidential information such as API keys, passwords, credentials, personal data, or proprietary code in your query.

| Quality | Example |
|---------|---------|
| Good | `"How to set up authentication with JWT in Express.js"` |
| Good | `"React useEffect cleanup function with async operations"` |
| Bad | `"auth"` |
| Bad | `"hooks"` |

Use the user's full question as the query when possible, vague one-word queries return generic results.

The output contains two types of content: **code snippets** (titled, with language-tagged blocks) and **info snippets** (prose explanations with breadcrumb context).

## Authentication

Works without authentication. For higher rate limits:

```bash
# Option A: environment variable
export CONTEXT7_API_KEY=your_key

# Option B: OAuth login
ctx7 login
```

## Error Handling

If a command fails with a quota error ("Monthly quota reached" or "quota exceeded"):
1. Inform the user their Context7 quota is exhausted
2. Suggest they authenticate for higher limits: `ctx7 login`
3. If they cannot or choose not to authenticate, answer from training knowledge and clearly note it may be outdated

Do not silently fall back to training data — always tell the user why Context7 was not used.

## Common Mistakes

- Library IDs require a `/` prefix — `/facebook/react` not `facebook/react`
- Always run `ctx7 library` first — `ctx7 docs react "hooks"` will fail without a valid ID
- Use descriptive queries, not single words — `"React useEffect cleanup function"` not `"hooks"`
- Do not include sensitive information (API keys, passwords, credentials) in queries
```


---

# User skill: postgres-db-architecture

**Install path:** `~/.cursor/skills/postgres-db-architecture/SKILL.md`

```markdown
---
name: postgres-db-architecture
description: >-
  Designs and rolls out ANI Stock PostgreSQL schema for fast live reads:
  ER diagrams, normalization (instruments dimension), partitioning, archive schema,
  and EOD archival. Use when planning database architecture, adding tables,
  fixing slow dashboard/API loading, post-market data retention, dbdiagram.io,
  or mentions normalization, archive schema, hot vs cold tables, or eod_archive.
---

# ANI Stock PostgreSQL — architecture & loading performance

Apply this skill **during design** (before shipping new tables or heavy queries) so hot tables stay small and live reads stay fast.

## When to use

- New feature needs persistent storage
- Dashboard/API feels slow under live market load
- Tables grow without retention (intraday, alerts, audit logs)
- User asks for ER diagram, normalization, or archival strategy

## Canonical docs (read before changing schema)

| Resource | Path |
|----------|------|
| ER (dbdiagram.io) | `docs/database/ER_DIAGRAM.dbml` |
| ER (PlantUML) | `docs/database/ER_DIAGRAM.puml` |
| Column reference | `docs/database/SCHEMA_COLUMNS.md` |
| Full normalization + archive plan | `docs/database/NORMALIZATION_AND_ARCHIVE.md` |
| Detailed checklist | [reference.md](reference.md) |

Backend root: `/opt/ani-stock/backend_stockdashboard`

---

## Architecture decision checklist

Copy and complete **before** implementing schema changes:

```
Architecture review:
- [ ] Table is HOT (live session) or ARCHIVE (historical only)?
- [ ] Symbol keyed? → plan `instruments.id` FK, not bare VARCHAR
- [ ] Time-series? → partition by day (intraday) or month (historical)
- [ ] Retention window defined (see table below)?
- [ ] EOD job step added if rows must move off hot tables?
- [ ] API route reads hot only for live endpoints?
- [ ] Indexes match query pattern (symbol+time DESC, partial for unread alerts)?
- [ ] ER diagram updated (dbml + puml)?
- [ ] Migration SQL in scripts/migrations/NNN_*.sql?
```

### Hot vs archive routing

| Endpoint type | Data source |
|---------------|-------------|
| Live dashboard, movers, intraday triggers | **hot** tables only |
| Historical screens, backtest | hot + archive (date-routed) |
| Notification inbox (today) | hot `alerts` |
| Notification history | hot ∪ archive |

---

## Target layout

```
HOT (public) — live session + rolling window
  instruments, instrument_quotes_latest
  intraday_* (today's partition)
  alerts (recent), technical_signals (90d)

        │ EOD ~16:28 IST (trading days)
        ▼

ARCHIVE (archive schema) — backtests, history screens
  sector_info_daily, alerts, intraday_*, historical_candles
```

---

## Rollout phases (do in order)

### Phase 1 — Instrument dimension (low risk)

1. Apply migration `019_instruments_dimension_postgresql.sql`
2. Backfill `instruments` from `stocks_sector_info`
3. Add `instrument_quotes_latest`; dual-write from ingestion
4. New user-scoped tables: use `instrument_id` FK + keep `symbol` during transition

### Phase 2 — Partition time-series

- `intraday_stock_candles` — **daily** partitions (hot = today only)
- `historical_candles` — **monthly** partitions (hot = 24 months)
- `technical_signals`, `alerts` — monthly by date/timestamp

### Phase 3 — Archive schema + EOD job

1. Apply migration `018_archive_schema_postgresql.sql`
2. Wire / verify scheduler job `eod_database_archive` (16:28 IST Mon–Fri)
3. Implement API hot/archive routing per endpoint

---

## Retention policy (defaults)

| Table | Hot retention | Archive |
|-------|---------------|---------|
| intraday_stock_candles | 1 trading day | 2 years |
| historical_candles | 24 months | indefinite |
| technical_signals | 90 days | 3 years |
| alerts (read) | 30 days hot window; archive >90d read | 1 year |
| auth_audit_logs | 90 days | 1 year |
| page_visits | 30 days | 90 days |
| next_week_setup_live | current session | truncate EOD |
| stocks_sector_info | latest row | daily → `archive.sector_info_daily` |

---

## One-time setup

From backend root:

```bash
cd /opt/ani-stock/backend_stockdashboard
bash .cursor/skills/postgres-db-architecture/scripts/apply-db-architecture.sh
```

Or manually (use `scripts/lib/load_dotenv.sh` — do not `source .env` if password contains `#`):

```bash
source scripts/lib/load_dotenv.sh && load_dotenv_file .env
PSQL_URI="$(psql_database_uri)"
psql --dbname="$PSQL_URI" -f scripts/migrations/018_archive_schema_postgresql.sql
psql --dbname="$PSQL_URI" -f scripts/migrations/019_instruments_dimension_postgresql.sql
```

Verify:

```bash
bash .cursor/skills/postgres-db-architecture/scripts/verify-eod-archive.sh
```

---

## EOD archive job

**Code:** `app/jobs/eod_archive.py`  
**Scheduler:** `run_eod_database_archive_job` — cron **16:28 IST** Mon–Fri (`id=eod_database_archive`)  
**Disable:** `EOD_DATABASE_ARCHIVE=false`

Manual run:

```bash
cd /opt/ani-stock/backend_stockdashboard
source .venv/bin/activate
python -m app.jobs.eod_archive
```

Job steps: sector snapshot → archive read alerts → prune audit/page visits → prune next_week_setup_live → archive intraday candles before today.

If `archive` schema is missing, job returns `status: skipped` (run migration 018 first).

After scheduler change: `sudo systemctl restart ani-backend`

---

## ER diagram workflow

1. Edit `docs/database/ER_DIAGRAM.dbml` and `ER_DIAGRAM.puml`
2. Import dbml at [dbdiagram.io](https://dbdiagram.io) for visual review
3. Update `SCHEMA_COLUMNS.md` for new/changed tables
4. Add numbered migration under `scripts/migrations/`

---

## Client-side loading (complement DB work)

DB archival reduces server scan cost; also verify client cache policy for live data:

| Layer | Rule |
|-------|------|
| Web `apiClient` | `skipCache: true` on alerts and live dashboard polls |
| Web/mobile dashboard | `applyLiveSessionRefreshPolicy()` refreshes alerts during market hours |
| Poll interval (live) | ~30s for dashboard + notification inbox |
| Backend middleware | Exclude `/api/advisor/alerts`, `/api/price-alerts/` from HTTP cache |

Web: `stockdashboard/src/utils/dashboardCachePolicy.js`  
Mobile: `mobile_isolated/src/utils/dashboardCachePolicy.js`

---

## New table template

When adding a table, answer in the PR/skill checklist:

1. **Domain:** user / market / advisor / audit?
2. **Cardinality:** rows per day at steady state?
3. **Query pattern:** primary filter columns?
4. **FK:** `app_users.id` and/or `instruments.id`?
5. **Retention:** prune or archive? Which EOD step?
6. **Partition:** yes/no and grain (day/month)?

Prefer integer FKs over repeated `symbol` VARCHAR joins.

---

## Additional resources

- Step-by-step rollout weeks, SQL examples, index list: [reference.md](reference.md)
- Project docs index: `docs/database/README.md`
```


---

# Supplement: postgres-db-architecture/reference.md

**Install path:** `~/.cursor/skills/postgres-db-architecture/reference.md`

```markdown
# PostgreSQL architecture — extended reference

Read only when implementing migrations, partitions, or API routing. Main workflow: [SKILL.md](SKILL.md).

## Current problems (why loading is slow)

| Issue | Impact |
|-------|--------|
| `symbol` VARCHAR in 20+ tables, no FK | Wide joins, duplicate sector strings |
| `stocks_sector_info` sector/subsector as strings | Cannot join efficiently to `sectors` / `subsectors` |
| `intraday_*` unbounded growth | Slow live scans, bloated indexes |
| `historical_candles` single heap | Full scans for backtests |
| `alerts`, audit, page_visits never pruned | Slow notification + analytics |
| `stocks` vs `stocks_sector_info` overlap | Redundant quote storage |

## Phase 1 SQL snippets

### instruments master

```sql
CREATE TABLE IF NOT EXISTS instruments (
    id              SERIAL PRIMARY KEY,
    symbol          VARCHAR(32) NOT NULL UNIQUE,
    exchange        VARCHAR(8) NOT NULL DEFAULT 'NSE',
    sector_id       INTEGER REFERENCES sectors(id),
    subsector_id    INTEGER REFERENCES subsectors(id),
    market_cap_bucket VARCHAR(16),
    is_fno          BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### instrument_quotes_latest

```sql
CREATE TABLE instrument_quotes_latest (
    instrument_id   INTEGER PRIMARY KEY REFERENCES instruments(id),
    price           DOUBLE PRECISION,
    volume          BIGINT,
    day1d           DOUBLE PRECISION,
    week1w          DOUBLE PRECISION,
    month1m         DOUBLE PRECISION,
    ema21           DOUBLE PRECISION,
    ema50           DOUBLE PRECISION,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Add instrument_id to user tables

```sql
ALTER TABLE watchlist ADD COLUMN instrument_id INTEGER REFERENCES instruments(id);
UPDATE watchlist w SET instrument_id = i.id
FROM instruments i WHERE UPPER(i.symbol) = UPPER(w.symbol);
CREATE INDEX ix_watchlist_instrument ON watchlist(instrument_id);
```

## Phase 2 — partitioning patterns

### historical_candles (monthly)

```sql
CREATE TABLE historical_candles_partitioned (
    LIKE historical_candles INCLUDING DEFAULTS INCLUDING CONSTRAINTS
) PARTITION BY RANGE (candle_date);
```

### intraday_stock_candles (daily)

```sql
CREATE TABLE intraday_stock_candles_partitioned (
    LIKE intraday_stock_candles INCLUDING DEFAULTS
) PARTITION BY RANGE (candle_time);
```

Live scanners query **only today's partition**.

### Detach intraday partition to archive

```sql
ALTER TABLE intraday_stock_candles_partitioned
    DETACH PARTITION intraday_stock_candles_YYYYMMDD;
ALTER TABLE intraday_stock_candles_YYYYMMDD SET SCHEMA archive;
```

## Phase 3 — EOD workflow (16:15–16:28 IST)

1. Snapshot sector info → `archive.sector_info_daily`
2. Detach intraday partition(s) before today → archive
3. Create tomorrow's empty intraday partition
4. Move read alerts older than 90d → `archive.alerts`
5. Truncate stale `next_week_setup_live`
6. `VACUUM (ANALYZE)` hot tables
7. Detach monthly partitions past retention → archive

Implementation: `app/jobs/eod_archive.py` + `run_eod_database_archive_job` in `app/scheduler.py`.

## Archive read alerts SQL

```sql
WITH moved AS (
    DELETE FROM alerts a
    WHERE a.is_read = TRUE
      AND a.timestamp < NOW() - INTERVAL '90 days'
    RETURNING *
)
INSERT INTO archive.alerts SELECT * FROM moved;
```

## API helper pattern

```python
def alerts_queryset(since: date, include_archive: bool):
    q = session.query(Alert).filter(Alert.timestamp >= since)
    if include_archive:
        q = q.union_all(archive_alerts_query(since))
    return q
```

## Hot table indexes

```sql
CREATE INDEX CONCURRENTLY ix_iql_updated ON instrument_quotes_latest(updated_at DESC);
CREATE INDEX CONCURRENTLY ix_alerts_ts_desc ON alerts (timestamp DESC)
    WHERE is_read = FALSE;
CREATE INDEX CONCURRENTLY ix_hc_symbol_date ON historical_candles (symbol, candle_date DESC);
```

## Rollout timeline (weeks)

| Week | Action |
|------|--------|
| 1 | `instruments` + `archive` schema + indexes |
| 2 | `instrument_quotes_latest`; dual-write |
| 3 | Partition `intraday_stock_candles`; swap |
| 4 | EOD archive on staging; verify counts |
| 5 | Partition `historical_candles` |
| 6 | `instrument_id` on watchlist/orders; switch API |
| 7 | Drop deprecated columns |

## Expected gains

| Query | After |
|-------|-------|
| Live intraday scan | Single-day partition only |
| Sector movers | FK join instruments → sectors |
| Alerts inbox | Partial index + 30d hot |
| Historical backtest | Partition pruning by month |
| Post-close API | Hot tables 10–100× smaller |

## Migration files

| File | Purpose |
|------|---------|
| `scripts/migrations/018_archive_schema_postgresql.sql` | `archive` schema, mirror tables, `job_runs` |
| `scripts/migrations/019_instruments_dimension_postgresql.sql` | `instruments`, `instrument_quotes_latest`, backfill |

## Files to update on schema change

1. `app/db/models.py`
2. `docs/database/ER_DIAGRAM.dbml` + `ER_DIAGRAM.puml`
3. `docs/database/SCHEMA_COLUMNS.md`
4. `scripts/migrations/NNN_description_postgresql.sql`
5. `app/jobs/eod_archive.py` (if retention/archive affected)
6. API routes that query the table (hot vs archive)
```


---

# Script: postgres-db-architecture/scripts/apply-db-architecture.sh

**Install path:** `~/.cursor/skills/postgres-db-architecture/scripts/apply-db-architecture.sh`

```bash
#!/usr/bin/env bash
# Apply ANI Stock DB architecture migrations (archive schema + instruments dimension).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/load_dotenv.sh"

if [[ -z "${DATABASE_URL:-}" ]]; then
  load_dotenv_file "$ROOT/.env"
fi

PSQL_URI="$(psql_database_uri)" || exit 1

echo "Applying 018_archive_schema_postgresql.sql ..."
psql --dbname="$PSQL_URI" -v ON_ERROR_STOP=1 -f scripts/migrations/018_archive_schema_postgresql.sql

echo "Applying 019_instruments_dimension_postgresql.sql ..."
psql --dbname="$PSQL_URI" -v ON_ERROR_STOP=1 -f scripts/migrations/019_instruments_dimension_postgresql.sql

echo "Done. Run verify-eod-archive.sh to smoke-test the EOD job."
```


---

# Script: postgres-db-architecture/scripts/verify-eod-archive.sh

**Install path:** `~/.cursor/skills/postgres-db-architecture/scripts/verify-eod-archive.sh`

```bash
#!/usr/bin/env bash
# Verify archive schema exists and EOD archive job runs (dry run via Python module).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/lib/load_dotenv.sh"

if [[ -z "${DATABASE_URL:-}" ]]; then
  load_dotenv_file "$ROOT/.env"
fi

PSQL_URI="$(psql_database_uri)" || exit 1

echo "Checking archive schema ..."
psql --dbname="$PSQL_URI" -v ON_ERROR_STOP=1 -c \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'archive';"

if [[ -d .venv ]]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

echo "Running EOD archive (may skip if non-trading day) ..."
python -m app.jobs.eod_archive

echo "Verify complete."
```


# PART 5 — INFRASTRUCTURE & DEPLOYMENT SETUP


---

# Setup: fullstack.code-workspace

**Install path:** `/opt/ani-stock/fullstack.code-workspace`

```json
{
  "folders": [
    {
      "name": "frontend (stockdashboard)",
      "path": "stockdashboard"
    },
    {
      "name": "backend (FastAPI)",
      "path": "backend_stockdashboard"
    }
  ],
  "settings": {
    "python.defaultInterpreterPath": "${workspaceFolder:backend (FastAPI)}/.venv/bin/python",
    "python.terminal.activateEnvironment": true,
    "python.analysis.extraPaths": ["${workspaceFolder:backend (FastAPI)}"],
    "basedpyright.analysis.diagnosticMode": "workspace",
    "basedpyright.analysis.venvPath": "${workspaceFolder:backend (FastAPI)}",
    "basedpyright.analysis.venv": ".venv",
    "files.eol": "\n",
    "files.trimTrailingWhitespace": true,
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "eslint.workingDirectories": ["${workspaceFolder:frontend (stockdashboard)}"],
    "search.exclude": {
      "**/node_modules": true,
      "**/build": true,
      "**/.venv": true,
      "**/__pycache__": true
    }
  },
  "launch": {
    "version": "0.2.0",
    "configurations": [
      {
        "name": "FastAPI (uvicorn)",
        "type": "debugpy",
        "request": "launch",
        "python": "${workspaceFolder:backend (FastAPI)}/.venv/bin/python",
        "module": "uvicorn",
        "args": ["app.main:app", "--reload", "--host", "127.0.0.1", "--port", "8000"],
        "cwd": "${workspaceFolder:backend (FastAPI)}",
        "jinja": true
      }
    ]
  },
  "extensions": {
    "recommendations": [
      "ms-python.python",
      "detachhead.basedpyright",
      "dbaeumer.vscode-eslint",
      "esbenp.prettier-vscode"
    ]
  }
}
```


---

# Setup: ani-backend.service

**Install path:** `/etc/systemd/system/ani-backend.service`

```ini
[Unit]
Description=ANI Stock FastAPI backend (orchestrator + Samco WebSocket via systemd)
Documentation=file:///opt/ani-stock/stockdashboard/docs/deployment/VPS_ENABLEMENT_CHECKLIST.md
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/ani-stock/backend_stockdashboard
EnvironmentFile=/opt/ani-stock/backend_stockdashboard/.env
# Single worker: one orchestrator + one Samco WS subprocess (see ORCHESTRATOR_LOCK_PATH in app/main.py)
ExecStart=/opt/ani-stock/backend_stockdashboard/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=5
# Do not start a second copy manually — use: systemctl restart ani-backend
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```


---

# Setup: nginx-aycindustries.com.conf

**Install path:** `/etc/nginx/sites-available/aycindustries.com`

```nginx
# /etc/nginx/sites-available/aycindustries.com
# Canonical host: https://www.aycindustries.com (API: https://www.aycindustries.com/api/...)
# Do not open the site via https://<VPS_IP> — cert is for aycindustries.com only (see nginx-ip-redirect.conf).

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 187.127.133.149 _;
    return 301 https://www.aycindustries.com$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name 187.127.133.149 _;

    ssl_certificate /etc/letsencrypt/live/aycindustries.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aycindustries.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://www.aycindustries.com$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name aycindustries.com www.aycindustries.com;
    return 301 https://www.aycindustries.com$request_uri;
}

# Apex HTTPS → canonical www
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name aycindustries.com;

    ssl_certificate /etc/letsencrypt/live/aycindustries.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aycindustries.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://www.aycindustries.com$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.aycindustries.com;

    ssl_certificate /etc/letsencrypt/live/aycindustries.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aycindustries.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/ani-stock;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location /static/ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
        try_files $uri =404;
    }

    # Signed Android APK for end-user side-load (rebuilt via deploy_mobile_android.sh).
    location = /mobile/ani-stock-release.apk {
        alias /opt/ani-stock/mobile-artifacts/ani-stock-release.apk;
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition 'attachment; filename="ani-stock-release.apk"';
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    location = /mobile/DOWNLOAD.json {
        alias /opt/ani-stock/mobile-artifacts/DOWNLOAD.json;
        default_type application/json;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Trusted-device login: browser sends X-Device-Id; forward explicitly (some stacks drop unknown headers).
        proxy_set_header X-Device-Id $http_x_device_id;

        proxy_read_timeout 120s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
        client_max_body_size 10m;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```


---

# Setup: verify-linux-dev-setup.sh

**Install path:** `/opt/ani-stock/scripts/verify-linux-dev-setup.sh`

```bash
#!/usr/bin/env bash
# Verify Ubuntu/Linux dev paths for ANI Stock (run on the VPS).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/backend_stockdashboard/.venv/bin/python"

echo "=== ANI Stock — Linux dev setup check ==="
uname -a
echo ""

if [[ ! -x "$PY" ]]; then
  echo "MISSING: $PY"
  echo "Run: bash $ROOT/backend_stockdashboard/scripts/setup_venv_linux.sh"
  exit 1
fi
echo "OK  Python: $PY"
"$PY" --version
echo ""

for mod in fastapi sqlalchemy pydantic; do
  if ! "$PY" -c "import $mod" 2>/dev/null; then
    echo "MISSING package: $mod (pip install -r requirements.txt)"
    exit 1
  fi
  echo "OK  import $mod"
done

echo ""
echo "Open in Cursor: $ROOT/fullstack.code-workspace"
echo "Interpreter: backend_stockdashboard/.venv/bin/python"
```


---

# Setup: vps_git_push.sh

**Install path:** `stockdashboard/scripts/vps_git_push.sh`

```bash
#!/usr/bin/env bash
# Push stockdashboard (ANIStockDashboard) to GitHub from the VPS.
# Fixes SSH passphrase prompts when the key is loaded into ssh-agent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

unset GIT_ASKPASS SSH_ASKPASS GIT_ASKPASS_MAIN 2>/dev/null || true

if ! git remote get-url origin | grep -q 'github.com.*ANIStockDashboard'; then
  git remote set-url origin git@github.com:Ayc120714/ANIStockDashboard.git
fi

if [[ ! -f "$HOME/.ssh/config" ]] && [[ -f "$HOME/.ssh/.config" ]]; then
  cp "$HOME/.ssh/.config" "$HOME/.ssh/config"
  chmod 600 "$HOME/.ssh/config"
fi

if ! ssh-add -l 2>/dev/null | grep -q ed25519; then
  if [[ -z "${SSH_AUTH_SOCK:-}" ]] || ! ssh-add -l >/dev/null 2>&1; then
    eval "$(ssh-agent -s)" >/dev/null
  fi
  echo "Loading SSH key (enter passphrase if prompted)..."
  ssh-add "$HOME/.ssh/id_ed25519"
fi

echo "Testing GitHub SSH..."
# ssh -T exits 1 even on success; capture output instead of pipefail on the pipeline.
ssh_out="$(ssh -T git@github.com 2>&1)" || true
echo "$ssh_out"
if ! echo "$ssh_out" | grep -qE 'successfully authenticated|Hi '; then
  echo "ERROR: GitHub SSH auth failed."
  echo "  1. Add this public key to GitHub → Settings → SSH keys (or repo Deploy keys):"
  cat "$HOME/.ssh/id_ed25519.pub"
  echo "  2. Or use HTTPS with a Personal Access Token:"
  echo "     git remote set-url origin https://github.com/Ayc120714/ANIStockDashboard.git"
  echo "     git push origin main   # username: Ayc120714, password: ghp_... token"
  exit 1
fi

echo "Commits to push:"
git log origin/main..HEAD --oneline 2>/dev/null || git log -3 --oneline

echo "Pushing to origin main..."
git push origin main
echo "Done."
```


---

# Setup: VPS enablement checklist

**Install path:** `stockdashboard/docs/deployment/VPS_ENABLEMENT_CHECKLIST.md`

```markdown
# VPS: full-stack enablement checklist (backend ↔ frontend)

Use this when **FII/DII, Market Insights, Screens, or SubSector data** look empty/wrong even after `git pull`.
Git is only half the story: the **production build**, **API base URL**, **Nginx → Uvicorn**, **database**, and **outbound jobs** must all line up.

Related: [VPS_RESTART_FRONTEND_BACKEND.md](./VPS_RESTART_FRONTEND_BACKEND.md), [VPS_DATA_STALENESS.md](./VPS_DATA_STALENESS.md), **[REPO_LAYOUT.md](./REPO_LAYOUT.md)** (where the backend folder lives), **[SAMCO_SCREENS_DATA.md](./SAMCO_SCREENS_DATA.md)** (candles → Top Movers / Volume / Alpha), **[VPS_DEBUG_SCREENS_DB.md](./VPS_DEBUG_SCREENS_DB.md)** (when Screens numbers are wrong — DB + Samco checklist), **[CURSOR_VPS_REMOTE.md](./CURSOR_VPS_REMOTE.md)** (open the VPS in Cursor via Remote-SSH), **[VPS_PER_USER_STATIC_EGRESS_PREP.md](./VPS_PER_USER_STATIC_EGRESS_PREP.md)** (packages and planning for per-user static broker egress).

---

## 0. Where is the backend? (one level up from `stockdashboard`)

The backend is **`backend_stockdashboard`**, **next to** `stockdashboard` under the same parent — **not** inside `stockdashboard/`.

| Context | Backend path |
|---------|----------------|
| **Local** (Cursor opens `.../stockdashboard`) | `../backend_stockdashboard` |
| **VPS (recommended)** | `/opt/ani-stock/backend_stockdashboard` |
| **Parent folder example** | `ANIStockProject/stockdashboard` + `ANIStockProject/backend_stockdashboard` |

`.vscode` and `npm run dev:fullstack` already assume this sibling layout.

---

## 1. Two repos — pull **both** (recommended)

| Repo | Typical path on VPS | Purpose |
|------|---------------------|--------|
| **Frontend** | `/opt/ani-stock/stockdashboard` | React app — `npm run build` |
| **Backend** | `/opt/ani-stock/backend_stockdashboard` | FastAPI — **separate** `git pull` (sibling of frontend) |

If you only pull **stockdashboard**, **API code never updates** (no FII fixes, trending EMA, subsector trend strings, etc.).

**Nested backend** (`/opt/ani-stock/stockdashboard/backend_stockdashboard`) is **legacy** — only use it if that path actually exists in your clone; otherwise always use the **sibling** path above.

```bash
cd /opt/ani-stock/stockdashboard && git pull origin main
cd /opt/ani-stock/backend_stockdashboard && git pull origin main
```

Confirm latest commits:

```bash
cd /opt/ani-stock/stockdashboard && git log -1 --oneline
cd /opt/ani-stock/backend_stockdashboard && git log -1 --oneline
```

**systemd `WorkingDirectory`** for `ani-backend` must point at the **backend** repo you actually pulled (see unit file: `systemctl cat ani-backend`).

---

## 2. Frontend **must** be built with the public API URL (not localhost)

`src/api/apiClient.js` uses:

```text
process.env.REACT_APP_API_URL || 'http://localhost:8000/api'
```

If **`REACT_APP_*` is unset at build time**, the bundle calls **`http://localhost:8000`** in users’ browsers → **every API fails** (FII/DII, stocks, auth).

### Required on the machine where you run `npm run build`

Create/update **`.env.production`** in the **frontend repo root** (same folder as `package.json`):

```env
REACT_APP_API_URL=https://www.aycindustries.com/api
REACT_APP_TRADE_API_URL=https://www.aycindustries.com/api
```

(Use your real domain if different.)

Then **rebuild and redeploy static files**:

```bash
cd /opt/ani-stock/stockdashboard
npm ci
npm run build
sudo rsync -av --delete build/ /var/www/ani-stock/
```

**There is no `npm start` on the VPS for production** — Nginx serves `/var/www/ani-stock`.

---

## 3. Nginx must be **running** and proxy `/api/` → backend

- **`reload`** only works if nginx is **already active**. If you see `nginx.service is not active`, run:

  ```bash
  sudo nginx -t && sudo systemctl start nginx
  sudo systemctl status nginx
  ```

- Site config should proxy **`/api/`** to **`http://127.0.0.1:8000`** (or your Uvicorn bind).

Quick checks:

```bash
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8000/api/system/status
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://www.aycindustries.com/api/system/status
```

Both should be **200** (replace domain as needed).

---

## 4. Backend service and `.env`

### 4a. Install Python deps in the **venv** (not system `pip`)

On **Debian / Ubuntu**, system Python is **PEP 668** (“externally managed”): **`pip install -r requirements.txt` without a venv fails** with `externally-managed-environment`.

The backend should use a project **virtualenv** (same one **`ani-backend`** uses — usually **`.venv`** next to `requirements.txt`):

```bash
cd /opt/ani-stock/backend_stockdashboard

# Create venv once if missing
test -d .venv || python3 -m venv .venv

source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

sudo systemctl restart ani-backend
```

Confirm **`systemd` points at that venv** (must match where you installed packages):

```bash
systemctl cat ani-backend | grep -E 'ExecStart|WorkingDirectory'
```

You should see something like **`…/backend_stockdashboard/.venv/bin/uvicorn`**. If **`ExecStart`** uses a different path, either install into **that** venv or align the unit file with **`/opt/ani-stock/backend_stockdashboard/.venv`**.

```bash
sudo systemctl restart ani-backend
sudo systemctl status ani-backend --no-pager
journalctl -u ani-backend -n 80 --no-pager
```

Backend **`backend_stockdashboard/.env`** must include at least:

- **`DATABASE_URL`** (or `SQLALCHEMY_DATABASE_URL`) → real PostgreSQL (or your DB)
- **`TOKEN_HASH_SECRET`** / auth secrets as you use in prod

If the API cannot connect to the DB, tables stay empty and pages show no data.

### 4b. Bootstrap vs orchestrator (Screens / candles saving)

| Variable | Effect |
|----------|--------|
| **`STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=false`** | **Recommended VPS:** API + orchestrator up immediately; **one** worker runs full Samco/DB bootstrap in the **background** (file lock). Frontend shows a **sync banner** until `GET /api/system/readiness` → `bootstrap_complete: true`. |
| **`STARTUP_BOOTSTRAP_BEFORE_ORCHESTRATOR=true`** | Leader worker starts orchestrator **after** bootstrap; use if you explicitly want the leader to delay orchestrator until sync completes. |

Copy from **`backend_stockdashboard/.env.production.example`** after `git pull`.

**Uvicorn workers:** `systemctl cat ani-backend` — if you use **`--workers 2`**, the log line *“Another worker holds bootstrap lock”* is **normal** (only one runs `run_startup_data_bootstrap`). For smallest VPS you may use **`--workers 1`** to avoid duplicate orchestrator instances.

**Do not** restart `ani-backend` repeatedly during the first **30–60+ minutes** after deploy if CandleSync is still running, or `historical_candles` may never fully populate.

---

## 5. FII/DII specifically (not “generated” in app — **scraped + DB**)

**Flow:**

1. Browser → `GET /api/fii-dii/?days=20` (via `REACT_APP_API_URL`)
2. API reads **`fii_dii_activity`**; if empty/stale, tries **`refresh_fii_dii_data()`** → HTTP GET **Trendlyne** (`app/external/fii_dii_fetcher.py`)

**Nothing to “enable” in Git** except deploying backend code. **Operational requirements:**

| Check | Command / action |
|--------|------------------|
| API returns JSON | `curl -sS "https://YOUR_DOMAIN/api/fii-dii/?days=5" \| head -c 600` |
| VPS can reach Trendlyne | `curl -sSI https://trendlyne.com/macro-data/fii-dii/latest/cash-pastmonth/` |
| DB has rows | `SELECT COUNT(*), MAX(date) FROM fii_dii_activity WHERE category='cash';` |
| Errors in logs | `journalctl -u ani-backend \| grep -i fii` |

If Trendlyne **HTML changed** (table id / `data-jsondata`), the fetcher can fail until code is updated — check logs for `Could not locate Trendlyne cash table`.

Manual refresh (after deploy):

```bash
curl -sS "http://127.0.0.1:8000/api/fii-dii/refresh"
```

---

## 5b. Admin-only UI (Admin Users / Telegram Admin)

**Already implemented** in code:

| Layer | Behaviour |
|--------|-----------|
| **Sidebar** | `src/components/Sidebar/Sidebar.js` — links render only when `useAuth().isSuperAdmin` is true. |
| **Routes** | `src/routes/AppRouter.js` — `/admin-users` and `/telegram-admin` are wrapped in `<AdminRoute>`. |
| **AdminRoute** | `src/routes/AdminRoute.js` — not logged in → `/login`; not super-admin → `/` (dashboard). |
| **Backend** | `app/api/auth.py` — `AUTH_SUPER_ADMIN_EMAILS` (comma list); admin APIs call `_require_super_admin()`. |

**Frontend** super-admin list: `REACT_APP_SUPER_ADMIN_EMAILS` (optional) merged with defaults in `src/auth/AuthContext.js`.
**Backend** must list the **same** emails: `AUTH_SUPER_ADMIN_EMAILS` in `backend_stockdashboard/.env` (defaults include `gvc1990@gmail.com`, `admin@aycindustries.com`).

If a normal user still **manually opens** `/admin-users`, they are redirected home; API calls from their token return **403** from protected admin routes.

### Trusted device (skip email OTP for 7 days)

- The app sends **`X-Device-Id`** on every API request; after a successful OTP, checking **“Trust this device”** inserts/updates **`trusted_login_devices`** (hashed id + expiry).
- **Nginx `/api/`:** forward the header — `proxy_set_header X-Device-Id $http_x_device_id;` (see `docs/deployment/nginx-aycindustries.com.conf`). If the header never reaches FastAPI, OTP is always required.
- **`AUTH_TRUSTED_DEVICE_FOR_SUPER_ADMIN`**: default **true** (super-admins can use trusted device). Set **`false`** in `.env` if admins must OTP every login.
- Changing **`TOKEN_HASH_SECRET`** changes how device ids are hashed; users re-trust once.

### Screens / 3-year snapshot backfill (backend)

After each backend start, **`STARTUP_SCREEN_SNAPSHOT_BACKFILL_DAYS`** (default **1095** ≈ 3 years) drives a **background** `backfill_snapshots` so **Screens** history fills without blocking API readiness. Optional: set **`STARTUP_SCREEN_SNAPSHOT_BACKFILL_DAYS=365`** on a small VPS if needed. Index multi-year % uses existing Samco index EOD backfill (**`SAMCO_INDEX_BACKFILL_DAYS`**, default 1200) inside the candle sync path.

---

## 6. Other pages (quick mapping)

| UI area | API (examples) | If empty, check |
|---------|----------------|-----------------|
| Market indices / FII cards | `/api/market-indices/`, `/api/fii-dii/` | Build URL, nginx, DB, Trendlyne |
| SubSector Insights | `/api/subsector-outlook/grouped` | Backend pull, `StockSectorInfo` / weekly jobs. **CHG% fix:** **`STOCK_PERSIST_EOD_DAY1D=true`** (default) saves EOD-based `day1d` when `/api/subsector-stocks` loads a page — keeps Screens/Trending aligned with the modal. |
| Screens → Trending | `/api/stocks/trending` | `StockSectorInfo.day1d`, snapshots — see [VPS_DATA_STALENESS.md](./VPS_DATA_STALENESS.md) |
| Advisor / Alerts | advisor + scheduler routes | DB jobs, not only Git |

---

## 7. Browser verification (always do this)

1. Open site → **F12 → Network**.
2. Reload → find **`fii-dii`** or **`market-indices`**.
3. Confirm **Request URL** is **`https://your-domain/api/...`**, not `localhost`.
4. Status **200** and JSON body — not HTML error page.

If the request URL is still `localhost:8000`, **rebuild the frontend** with `.env.production` as in section 2.

---

## 8. React Native mobile app (`mobile_isolated/`)

The Android client lives in **`stockdashboard/mobile_isolated/`** and talks to the same FastAPI backend as the web app.

| Check | Action |
|--------|--------|
| **API base URL** | Release builds read `mobile_isolated/.env.production`: `MOBILE_API_URL=https://www.aycindustries.com/api` (canonical Nginx on **443**, not `:8443`). |
| **Nginx** | `/api/` block must forward **`X-Device-Id`** — see `docs/deployment/nginx-aycindustries.com.conf`. Required for trusted-device login (skip email OTP for 7 days). |
| **Backend auth** | `TRUSTED_DEVICE_DAYS=7`, working SMTP (`SMTP_*`) for email OTP, `TOKEN_HASH_SECRET` stable across restarts. |
| **Broker deep links** | App scheme `anistock://broker/callback` — no server change; broker OAuth redirect must match user profile. |
| **Readiness** | Mobile dashboard uses same APIs; confirm `curl -sS https://www.aycindustries.com/api/system/readiness` returns JSON with `bootstrap_complete: true` after backend bootstrap. |
| **CI APK** | Push to `main` → GitHub Actions **Android APK** (`.github/workflows/android-apk.yml`) builds from `mobile_isolated/**`. |
| **Dev sync** | From dev machine: `npm run mobile:isolated:sync` (or in `c:\ani-mobile`: `npm run sync:stockdashboard`) before committing mobile changes. |

Quick smoke test from a phone/emulator:

```bash
curl -sS -o /dev/null -w "%{http_code}" https://www.aycindustries.com/api/system/status
curl -sS -H "X-Device-Id: smoke-test-device" https://www.aycindustries.com/api/system/readiness
```

Both should return **200** JSON (not HTML).

---

## Summary: “nothing works” order of operations

1. **`git pull`** frontend **and** backend repos.
2. **Backend:** `.env`, `systemctl restart ani-backend`, `curl localhost:8000/api/system/status`.
3. **Frontend:** `.env.production` → **`npm run build`** → **rsync** to `/var/www/ani-stock/`.
4. **Nginx:** `start` if inactive, `nginx -t`, proxy test with `curl` to domain.
5. **FII/DII:** `curl` API + Trendlyne from VPS + DB row count + logs.

No separate Git branch is required for these features — **`main`** is fine as long as both repos are deployed and the **production build** uses the **public API base URL**.
```


---

# End of bundle

Regenerate this file:

```bash
python3 /opt/ani-stock/stockdashboard/docs/generate-skills-bundle.py
```
