/** Mobile API timeouts — heavy screen endpoints need more headroom than dashboard fan-out calls. */
export const API_TIMEOUT_MS = {
  default: 45_000,
  screen: 60_000,
  screenHeavy: 90_000,
  advisor: 90_000,
  dashboardParallel: 30_000,
  dashboardFast: 25_000,
  startup: 30_000,
};
