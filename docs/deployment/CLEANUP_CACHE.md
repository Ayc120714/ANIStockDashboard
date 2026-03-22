# Clean caches & old images (faster disk, cleaner builds)

This repo accumulates **build output**, **webpack/babel caches**, and (if you use Docker) **unused images**. Use the sections that apply to your machine.

---

## 1. This project (frontend) — recommended

From the `stockdashboard` folder:

```bash
npm run clean
```

Or:

```bash
node scripts/clean-cache.js
```

**Removes:** `build/`, `coverage/`, `.eslintcache`, `node_modules/.cache/`, `node_modules/.cache-loader/` (if present).

**Optional:** reinstall dependencies from scratch:

```bash
node scripts/clean-cache.js --all-deps
npm install
```

---

## 2. npm cache (global)

Clears the global npm download cache (can be several GB over time):

```bash
npm cache clean --force
```

---

## 3. Docker (VPS or local dev)

**Unused images, build cache, stopped containers:**

```bash
docker system prune -a --volumes
```

Review the prompt; this removes **all** unused images, not just this project. For a lighter trim:

```bash
docker image prune -a
docker builder prune -a
```

---

## 4. Python / backend (sibling `backend_stockdashboard`)

Safe to delete occasionally:

- `**/__pycache__/` (recreate on next run)
- `.pytest_cache/`, `.mypy_cache/` if present

Example (PowerShell, from backend folder):

```powershell
Get-ChildItem -Recurse -Directory -Filter __pycache__ | Remove-Item -Recurse -Force
```

---

## 5. Cursor / VS Code (optional)

Editor caches live **outside** the repo (e.g. `%APPDATA%\Cursor` on Windows). Clearing them can free space but may reset some UI state.

- **Cursor:** Settings → search “clear” or manually remove old cache folders only if you know what you’re doing.
- **Workspace storage** (screenshots, etc.): not part of git; safe to delete old project-specific folders under Cursor’s `User/workspaceStorage` if you need space — **close Cursor first**.

---

## 6. OneDrive / sync

If the repo is under OneDrive, large `build/` and `node_modules/` folders can slow sync. Keep `build/` and `node_modules/` **ignored** (see `.gitignore`) and run `npm run clean` before zipping the project.

---

## Quick checklist

| Action | Command |
|--------|----------------|
| Project caches | `npm run clean` |
| npm global cache | `npm cache clean --force` |
| Docker unused | `docker system prune -a` (careful) |
| Backend `__pycache__` | delete folders or use snippet above |
