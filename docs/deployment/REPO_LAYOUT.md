# Repository layout — frontend vs backend

The **FastAPI backend is not inside the React app folder**. It lives **one directory level up** from `stockdashboard`, as a **sibling** folder under the same parent (e.g. `ANIStockProject`).

## Local development (Windows / Mac / Linux)

Typical parent folder:

```text
ANIStockProject/                    ← parent (one level above stockdashboard)
├── stockdashboard/                 ← frontend (React) — often opened as Cursor workspace root
│   ├── package.json
│   └── docs/
└── backend_stockdashboard/         ← backend (FastAPI) — same parent as stockdashboard
    ├── requirements.txt
    └── app/
```

**From inside `stockdashboard`**, the backend path is:

```text
../backend_stockdashboard
```

This matches:

- **`stockdashboard/.vscode/settings.json`**: e.g. `python.defaultInterpreterPath` → `${workspaceFolder}/../backend_stockdashboard/.venv/Scripts/python.exe`
- **`stockdashboard/fullstack.code-workspace`**: second folder is `../backend_stockdashboard`
- **Parent `ANIStockProject/fullstack.code-workspace`**: same sibling layout when you open the parent repo

**Do not** rely on `stockdashboard/backend_stockdashboard` unless you intentionally maintain a nested copy (duplicate, easy to forget to pull).

## Production (VPS) — recommended

Clone **two repos** side by side under `/opt/ani-stock`:

```text
/opt/ani-stock/
├── stockdashboard/          ← git: ANIStockDashboard (or your frontend repo)
└── backend_stockdashboard/  ← git: backend_stockdashboard
```

- **systemd `WorkingDirectory`**: `/opt/ani-stock/backend_stockdashboard`
- **`.env`**: `/opt/ani-stock/backend_stockdashboard/.env`
- **`git pull`**: run in **each** folder after deploy

See also: [VPS_ENABLEMENT_CHECKLIST.md](./VPS_ENABLEMENT_CHECKLIST.md), [VPS_RESTART_FRONTEND_BACKEND.md](./VPS_RESTART_FRONTEND_BACKEND.md).

## Legacy: nested backend (monorepo copy)

Some older docs referred to `stockdashboard/backend_stockdashboard`. Only use that layout if your **frontend** repository actually **contains** a full backend tree (unusual). If you use the **sibling** layout above, point **systemd** and **`BACKEND_DIR`** at `/opt/ani-stock/backend_stockdashboard`, not under `stockdashboard/`.
