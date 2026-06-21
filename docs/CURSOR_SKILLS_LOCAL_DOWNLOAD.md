# Cursor setup bundle — local download

> **Complete single file (skills + rules + agents + VPS setup):**  
> **[ANI_STOCK_CURSOR_SKILLS_COMPLETE.md](./ANI_STOCK_CURSOR_SKILLS_COMPLETE.md)**

That file contains everything needed to recreate the ANI Stock Cursor agent environment:

| Included | Count |
|----------|-------|
| Repo-root Cursor rules | 3 |
| Project Cursor rules | 4 |
| User Cursor rules | 1 |
| Custom agents | 2 |
| Project skills + scripts | 10 skills |
| User skills + scripts | 2 skills |
| Infrastructure setup | workspace, systemd, nginx, verify scripts, VPS checklist |

## Download to your machine

```bash
scp YOUR_VPS:/opt/ani-stock/stockdashboard/docs/ANI_STOCK_CURSOR_SKILLS_COMPLETE.md .
```

## Install from the bundle

1. Read **Part 0** in the bundle for the full enablement checklist.
2. For each section, create the file at the **Install path** and paste the fenced content.
3. Run `chmod +x` on all `*.sh` scripts listed in Part 0.

## Regenerate on the VPS (after editing rules/skills)

```bash
python3 /opt/ani-stock/stockdashboard/docs/generate-skills-bundle.py
```

## Quick copy (live tree, no bundle)

```bash
# Project rules + skills + agents
scp -r YOUR_VPS:/opt/ani-stock/.cursor/rules YOUR_LOCAL/ani-stock/.cursor/
scp -r YOUR_VPS:/opt/ani-stock/stockdashboard/.cursor YOUR_LOCAL/ani-stock/stockdashboard/

# User skills + rules
scp -r YOUR_VPS:/root/.cursor/skills ~/.cursor/
scp -r YOUR_VPS:/root/.cursor/rules ~/.cursor/
```

Replace `YOUR_VPS` with your server hostname or IP.
