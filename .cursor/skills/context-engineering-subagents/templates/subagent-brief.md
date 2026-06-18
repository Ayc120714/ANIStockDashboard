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
