import {env} from '@core/config/env';
import {dashboardService} from '@core/api/services/dashboardService';
import {signalsService} from '@core/api/services/signalsService';
import {advisorService} from '@core/api/services/advisorService';
import {ordersService} from '@core/api/services/ordersService';
import {brokersService} from '@core/api/services/brokersService';
import {alertsService} from '@core/api/services/alertsService';
import {marketsService} from '@core/api/services/marketsService';
import {authService} from '@core/api/services/authService';

const countRows = payload => {
  if (Array.isArray(payload)) return payload.length;
  if (Array.isArray(payload?.data)) return payload.data.length;
  if (payload && typeof payload === 'object') return Object.keys(payload).length;
  return payload ? 1 : 0;
};

/** One API probe per app page/module. Requires a valid logged-in session. */
export const PAGE_CONNECTIVITY_CHECKS = [
  {
    page: 'Auth',
    name: 'Session (/auth/me)',
    run: async () => {
      const me = await authService.fetchMe();
      return `user=${me?.email || me?.id || 'ok'}`;
    },
  },
  {
    page: 'Dashboard',
    name: 'Market indices',
    run: async () => {
      const res = await dashboardService.fetchMarketIndices();
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Dashboard',
    name: 'Watchlist',
    run: async () => {
      const res = await dashboardService.fetchWatchlist();
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Dashboard',
    name: 'Advisor alerts',
    run: async () => {
      const res = await dashboardService.fetchAdvisorAlerts();
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Stocks',
    name: 'Sector outlook',
    run: async () => {
      const res = await dashboardService.fetchSectorOutlook();
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Stocks',
    name: 'Sub-sector outlook',
    run: async () => {
      const res = await dashboardService.fetchSubsectorOutlook();
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Stocks',
    name: 'FII/DII',
    run: async () => {
      const res = await dashboardService.fetchFiiDii({days: 10});
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Stocks',
    name: 'Long-term watchlist',
    run: async () => {
      const res = await dashboardService.fetchWatchlistByListType('long_term');
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Stocks',
    name: 'Short-term watchlist',
    run: async () => {
      const res = await dashboardService.fetchWatchlistByListType('short_term');
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Screens',
    name: 'Weekly AI picks',
    run: async () => {
      const res = await dashboardService.fetchWeeklyPicks();
      const bull = Array.isArray(res?.bullish) ? res.bullish.length : 0;
      const bear = Array.isArray(res?.bearish) ? res.bearish.length : 0;
      return `bull=${bull}, bear=${bear}`;
    },
  },
  {
    page: 'Screens',
    name: 'Trending',
    run: async () => {
      const res = await dashboardService.fetchTrending(40);
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Screens',
    name: 'Top movers',
    run: async () => {
      const res = await dashboardService.fetchPriceShockers({type: 'gainers', period: 'day'});
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Screens',
    name: 'Volume shockers',
    run: async () => {
      const res = await dashboardService.fetchVolumeShockers({limit: 40, period: 'day'});
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Screens',
    name: 'Alpha tracker',
    run: async () => {
      const res = await dashboardService.fetchRelativePerformance({period: '1w', limit: 40});
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Screens',
    name: 'IPOs',
    run: async () => {
      const res = await dashboardService.fetchIpos({limit: 40});
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Advisor',
    name: 'Latest signals',
    run: async () => {
      const res = await signalsService.fetchLatestSignals({limit: 40});
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Advisor',
    name: 'Trend reversal screener',
    run: async () => {
      const res = await advisorService.fetchIndicatorScreener({limit: 40});
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Signals',
    name: 'Signals list',
    run: async () => {
      const res = await signalsService.fetchLatestSignals({limit: 80});
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Markets',
    name: 'Market indices tab',
    run: async () => {
      const res = await dashboardService.fetchMarketIndices();
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Markets',
    name: 'Sector tab',
    run: async () => {
      const res = await dashboardService.fetchSectorOutlook();
      return `rows=${countRows(res)}`;
    },
  },
  {
    page: 'Portfolio',
    name: 'Open positions',
    run: async () => {
      const res = await ordersService.fetchPortfolioPositions();
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Portfolio',
    name: 'Orders history',
    run: async () => {
      const res = await ordersService.fetchOrders();
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Orders',
    name: 'Orders API',
    run: async () => {
      const res = await ordersService.fetchOrders();
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Orders',
    name: 'Execution mode',
    run: async () => {
      const res = await ordersService.fetchExecutionMode();
      return `mode=${res?.mode || res?.execution_mode || 'ok'}`;
    },
  },
  {
    page: 'Brokers',
    name: 'Broker setup',
    run: async () => {
      const res = await brokersService.fetchBrokerSetup();
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Brokers',
    name: 'Broker options',
    run: async () => {
      const res = await brokersService.fetchBrokerOptions();
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Alerts',
    name: 'Live advisor alerts',
    run: async () => {
      const res = await alertsService.fetchLiveAdvisorAlerts({limit: 40});
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Alerts',
    name: 'Price alerts',
    run: async () => {
      const res = await alertsService.fetchPriceAlerts();
      return `rows=${countRows(res?.data ?? res)}`;
    },
  },
  {
    page: 'Markets (F&O)',
    name: 'F&O summary',
    run: async () => {
      const res = await marketsService.fetchFnoSummary();
      return `ok=${Boolean(res)}`;
    },
  },
  {
    page: 'Markets (F&O)',
    name: 'Commodities summary',
    run: async () => {
      const res = await marketsService.fetchCommoditiesSummary();
      return `ok=${Boolean(res)}`;
    },
  },
  {
    page: 'Markets (F&O)',
    name: 'Forex summary',
    run: async () => {
      const res = await marketsService.fetchForexSummary();
      return `ok=${Boolean(res)}`;
    },
  },
  {
    page: 'System',
    name: 'System readiness',
    run: async () => {
      const res = await dashboardService.fetchSystemReadiness();
      return `bootstrap=${Boolean(res?.bootstrap_complete)}`;
    },
  },
  {
    page: 'System',
    name: 'OHLCV cache sync agent',
    run: async () => {
      const res = await dashboardService.fetchSystemStatus();
      const cache = res?.orchestrator?.ohlcv_cache_sync;
      if (!cache || typeof cache !== 'object') {
        throw new Error('ohlcv_cache_sync missing from /system/status');
      }
      if (!cache.enabled) {
        throw new Error('OHLCV cache agent disabled (OHLCV_CACHE_ENABLED=false)');
      }
      const sym = Number(cache.symbols_cached) || 0;
      const state = cache.running ? 'running' : 'idle';
      return `${state}, symbols_cached=${sym}`;
    },
  },
  {
    page: 'Web portal',
    name: 'Web app URL configured',
    run: async () => {
      if (!env.webAppUrl || !/^https?:\/\//.test(env.webAppUrl)) {
        throw new Error('MOBILE_WEB_APP_URL is missing or invalid');
      }
      return env.webAppUrl;
    },
  },
];

export async function runPageConnectivityChecks({includeAdmin = false} = {}) {
  const checks = [...PAGE_CONNECTIVITY_CHECKS];
  if (includeAdmin) {
    checks.push({
      page: 'Admin',
      name: 'Admin users',
      run: async () => {
        const res = await authService.fetchAdminUsers(false);
        return `rows=${countRows(res?.data ?? res)}`;
      },
    });
  }

  const results = [];
  for (const check of checks) {
    try {
      const detail = await check.run();
      results.push({page: check.page, name: check.name, status: 'PASS', detail: String(detail || '')});
    } catch (error) {
      results.push({
        page: check.page,
        name: check.name,
        status: 'FAIL',
        detail: String(error?.message || error),
      });
    }
  }
  return results;
}
