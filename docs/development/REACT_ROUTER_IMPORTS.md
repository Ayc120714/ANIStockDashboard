# React Router imports (CRA + v6 / v7–safe)

## Webpack (CRACO)

The app uses **`@craco/craco`** so Webpack always resolves **`react-router`**, **`react-router-dom`**, and **`@remix-run/router`** from this project’s `node_modules`. That fixes errors like *export `json` was not found in `react-router`* when a duplicate or older `react-router` is hoisted.

- Scripts use **`craco start` / `craco build` / `craco test`** (see root `craco.config.js`).
- CRA’s **`ModuleScopePlugin`** is removed only to allow those aliases (common for tooling that must pin packages).

If you still see router export errors: clean install (`Remove-Item -Recurse node_modules; npm ci`) then `npm start`.

---


Webpack may fail to resolve some re-exports when `react-router` and `react-router-dom` versions differ, or when **React Router v7** is installed. Use this split:

| Import from | Symbols |
|-------------|---------|
| **`react-router`** | `Routes`, `Route`, `Outlet`, `useNavigate`, `useLocation`, `Navigate`, `useParams`, `useMatch`, … |
| **`react-router-dom`** | `BrowserRouter`, `HashRouter`, `Link`, `NavLink`, `useSearchParams`, … |

### Examples

```javascript
import { BrowserRouter as Router } from 'react-router-dom';
import { Routes, Route, Outlet, useNavigate, useLocation, Navigate } from 'react-router';
import { Link, useSearchParams } from 'react-router-dom';
```

### Versions

`package.json` pins **`react-router` and `react-router-dom` to `6.30.3`** with **`overrides`** so nested deps cannot pull a mismatched major.

After clone or pull:

```bash
rm -rf node_modules
npm ci
npm run build
```

### Webpack: `export 'json' / 'defer' / …' was not found in 'react-router'`

This means **`react-router-dom` is newer than the hoisted `react-router`** (or `@remix-run/router` is wrong). `react-router-dom@6.30.3` must pair with **`react-router@6.30.3`** and **`@remix-run/router@1.23.2`**.

1. Ensure `package.json` still has the **`overrides`** block and pinned versions.
2. **Clean install** (Windows PowerShell):

   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item -Force package-lock.json   # only if lockfile is corrupted/out of sync
   npm install
   ```

3. `postinstall` runs `scripts/verify-router-deps.js` — if it errors, fix versions before `npm start`.

Do **not** use `npm install --ignore-scripts` for routine installs, or the version check is skipped.

### Verified app surfaces (use router hooks)

| Area | Files |
|------|--------|
| Router shell | `src/routes/AppRouter.js`, `src/routes/ProtectedRoute.js`, `src/routes/AdminRoute.js` |
| Layout | `src/layouts/MainLayout.js` (`Outlet`) |
| Auth / OTP | `LoginPage`, `SignupPage`, `OtpVerifyPage`, `ForgotPasswordPage`, `ForgotUserIdPage` |
| App pages using `useNavigate` / `useLocation` | `DashboardPage`, `ShortTermPage`, `ProfilePage`, `DhanCallbackPage` (`useSearchParams` from `react-router-dom`) |
| Navigation UI | `src/components/Sidebar/Sidebar.styles.js` (`Link` → styled `NavLink`) |

All other routed pages are declared in `AppRouter.js` and do not import router hooks unless extended later—follow the table above when adding `useNavigate`, etc.
