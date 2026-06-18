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
