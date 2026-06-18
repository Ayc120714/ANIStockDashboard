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
