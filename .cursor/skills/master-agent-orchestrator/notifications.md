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
