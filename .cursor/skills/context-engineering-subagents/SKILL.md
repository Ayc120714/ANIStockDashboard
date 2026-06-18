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
