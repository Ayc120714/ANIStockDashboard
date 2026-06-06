import { fetchBrokerSetup } from '../api/brokers';
import {
  fetchAngeloneHoldings,
  fetchAngeloneOrders,
  fetchAngelonePositions,
} from '../api/angelone';
import { fetchDhanHoldings, fetchDhanOrders, fetchDhanPositions } from '../api/dhan';
import { loadRestBrokerPortfolioSlices } from '../api/restBrokerPortfolio';
import {
  isBrokerHoldingsCacheFresh,
  readBrokerHoldingsCache,
  writeBrokerHoldingsCache,
} from './brokerHoldingsCache';
import { ensureNormalizedBrokerRows, normalizeBrokerRows } from './brokerHoldingsNormalize';

export { ensureNormalizedBrokerRows, normalizeBrokerRows } from './brokerHoldingsNormalize';

const DASHBOARD_BROKER_PRIORITY = ['dhan', 'angelone', 'samco', 'upstox', 'kotak', 'fyers', 'zerodha'];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const pickArrayRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.positions)) return payload.positions;
  if (Array.isArray(payload?.holdings)) return payload.holdings;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.open_positions)) return payload.open_positions;
  return [];
};

const deriveRowsFromDhanOrders = (payload) => {
  const rows = pickArrayRows(payload);
  const bySymbol = new Map();
  rows.forEach((row) => {
    const status = String(row?.orderStatus || row?.status || '').toUpperCase();
    if (!['FILLED', 'PARTIAL', 'COMPLETE', 'TRADED'].includes(status)) return;
    const symbol = String(
      row?.tradingSymbol || row?.tradingsymbol || row?.symbol || row?.securityId || '',
    ).trim().toUpperCase();
    if (!symbol) return;
    const side = String(row?.transactionType || row?.side || '').toUpperCase();
    const qty = toNumber(row?.filledQty ?? row?.quantity ?? row?.qty);
    if (qty <= 0) return;
    const price = toNumber(row?.averagePrice ?? row?.avgPrice ?? row?.price);
    const current = bySymbol.get(symbol) || { symbol, net_qty: 0, avg_num: 0, avg_den: 0 };
    if (side === 'BUY') {
      current.net_qty += qty;
      if (price > 0) {
        current.avg_num += qty * price;
        current.avg_den += qty;
      }
    } else if (side === 'SELL') {
      current.net_qty -= qty;
    }
    bySymbol.set(symbol, current);
  });
  return [...bySymbol.values()]
    .filter((r) => Math.abs(r.net_qty) > 0)
    .map((r) => ({
      symbol: r.symbol,
      product_type: 'DELIVERY',
      net_qty: r.net_qty,
      avg_price: r.avg_den > 0 ? r.avg_num / r.avg_den : 0,
      ltp: 0,
      unrealized_pnl: 0,
      realized_pnl: 0,
      state: 'OPEN',
    }));
};

const mergePositionsHoldingsOrders = (livePositionsResult, liveHoldingsResult, liveOrdersResult) => {
  const fromPositions = livePositionsResult.status === 'fulfilled'
    ? normalizeBrokerRows(livePositionsResult.value)
    : [];
  const fromHoldings = liveHoldingsResult.status === 'fulfilled'
    ? normalizeBrokerRows(liveHoldingsResult.value)
    : [];
  const portfolioRows = [...fromPositions, ...fromHoldings];
  if (portfolioRows.length) {
    const merged = new Map();
    portfolioRows.forEach((row) => {
      merged.set(`${row.symbol}_${row.product_type}`, row);
    });
    return [...merged.values()];
  }
  const fromOrders = liveOrdersResult?.status === 'fulfilled'
    ? deriveRowsFromDhanOrders(liveOrdersResult.value)
    : [];
  return fromOrders;
};

const brokerRowDrivesDashboardHoldings = (row) => {
  if (!row) return false;
  const b = String(row.broker || '').toLowerCase();
  if (b === 'dhan') return Boolean(row.has_session);
  return Boolean(row.live_enabled ?? row.has_session);
};

/**
 * Call broker APIs directly (positions + holdings + orders). Uses tradeApiGetLive (no short GET memo).
 */
export async function fetchLiveBrokerHoldingsFromApis(userId) {
  let authenticated = false;
  let activeBroker = null;

  if (!userId) {
    return { authenticated: false, activeBroker: null, rows: [] };
  }

  try {
    const setupRows = await fetchBrokerSetup({ userId });
    activeBroker = DASHBOARD_BROKER_PRIORITY.find((b) => {
      const r = setupRows.find((x) => String(x.broker || '').toLowerCase() === b);
      return brokerRowDrivesDashboardHoldings(r);
    }) || null;
    authenticated = Boolean(activeBroker);
  } catch (_) {
    return { authenticated: false, activeBroker: null, rows: [] };
  }

  if (!authenticated || !activeBroker) {
    return { authenticated: false, activeBroker: null, rows: [] };
  }

  let rows = [];
  try {
    if (activeBroker === 'dhan') {
      const [livePositionsResult, liveHoldingsResult] = await Promise.allSettled([
        fetchDhanPositions({ userId }),
        fetchDhanHoldings({ userId }),
      ]);
      const [ord0] = await Promise.allSettled([fetchDhanOrders({ userId })]);
      rows = mergePositionsHoldingsOrders(livePositionsResult, liveHoldingsResult, ord0);
    } else if (activeBroker === 'angelone') {
      const [p, h] = await Promise.allSettled([
        fetchAngelonePositions({ userId }),
        fetchAngeloneHoldings({ userId }),
      ]);
      const [o] = await Promise.allSettled([fetchAngeloneOrders({ userId })]);
      rows = mergePositionsHoldingsOrders(p, h, o);
    } else {
      const slices = await loadRestBrokerPortfolioSlices(activeBroker, userId);
      if (slices) {
        const [p, h, o] = slices;
        rows = mergePositionsHoldingsOrders(p, h, o);
      }
    }
  } catch (_) {
    rows = [];
  }

  return { authenticated, activeBroker, rows };
}

/**
 * Resolve holdings for dashboard: always fetch from active broker session token when connected.
 * Cache is only a short-lived offline fallback when the live API call fails.
 */
export async function resolveDashboardBrokerHoldings(userId, { forceLive = false } = {}) {
  if (!userId) {
    return { authenticated: false, activeBroker: null, rows: [], fromCache: false };
  }

  const cached = readBrokerHoldingsCache(userId);
  const cachedRows = ensureNormalizedBrokerRows(cached?.rows || []);
  const canUseCache = !forceLive
    && cachedRows.length
    && isBrokerHoldingsCacheFresh(cached?.updatedAt);

  if (canUseCache) {
    return {
      authenticated: Boolean(cached.broker),
      activeBroker: cached.broker,
      rows: cachedRows,
      fromCache: true,
    };
  }

  try {
    const fresh = await fetchLiveBrokerHoldingsFromApis(userId);
    if (fresh.authenticated) {
      writeBrokerHoldingsCache(userId, fresh.activeBroker, fresh.rows);
      return { ...fresh, fromCache: false };
    }
    if (cachedRows.length) {
      return {
        authenticated: Boolean(cached.broker),
        activeBroker: cached.broker,
        rows: cachedRows,
        fromCache: true,
      };
    }
    return { ...fresh, fromCache: false };
  } catch (_) {
    if (cachedRows.length) {
      return {
        authenticated: Boolean(cached.broker),
        activeBroker: cached.broker,
        rows: cachedRows,
        fromCache: true,
      };
    }
    return { authenticated: false, activeBroker: null, rows: [], fromCache: false };
  }
}
