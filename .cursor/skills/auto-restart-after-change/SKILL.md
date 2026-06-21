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
