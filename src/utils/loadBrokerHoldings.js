import { fetchBrokerSetup } from '../api/brokers';
import {
  fetchAngeloneHoldings,
  fetchAngeloneOrders,
  fetchAngelonePositions,
} from '../api/angelone';
import { fetchDhanHoldings, fetchDhanOrders, fetchDhanPositions } from '../api/dhan';
import { loadRestBrokerPortfolioSlices } from '../api/restBrokerPortfolio';
import {
  readBrokerHoldingsCache,
  shouldRefreshBrokerFromApi,
  writeBrokerHoldingsCache,
} from './brokerHoldingsCache';

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

export const normalizeBrokerRows = (payload) => {
  const rows = pickArrayRows(payload);
  const normalized = rows
    .map((row) => {
      const symbol = String(
        row?.tradingSymbol || row?.tradingsymbol || row?.symbol || row?.securityId || '',
      ).trim().toUpperCase();
      const buyQty = toNumber(row?.buyQty ?? row?.buy_qty ?? row?.buyQuantity);
      const sellQty = toNumber(row?.sellQty ?? row?.sell_qty ?? row?.sellQuantity);
      const computedHoldingQty = toNumber(
        (row?.dpQty ?? row?.dp_qty ?? row?.dpQuantity ?? 0)
        + (row?.t1Qty ?? row?.t1_qty ?? row?.t1Quantity ?? 0)
        + (row?.availableQty ?? row?.available_qty ?? row?.availableQuantity ?? 0),
      );
      const netQty = toNumber(
        row?.netQty
        ?? row?.net_qty
        ?? row?.netQuantity
        ?? row?.authorisedquantity
        ?? row?.authorisedQuantity
        ?? row?.quantity
        ?? row?.qty
        ?? row?.availableQty
        ?? row?.available_qty
        ?? row?.availableQuantity
        ?? row?.holdingQty
        ?? row?.holding_qty
        ?? row?.holdingQuantity
        ?? row?.totalQty
        ?? row?.total_qty
        ?? row?.totalQuantity
        ?? computedHoldingQty
        ?? (buyQty - sellQty),
      );
      if (!symbol || netQty === 0) return null;
      const avgPrice = toNumber(
        row?.buyAvg
        ?? row?.buyavg
        ?? row?.buyAvgPrice
        ?? row?.buyavgprice
        ?? row?.buyaverageprice
        ?? row?.avgPrice
        ?? row?.averagePrice
        ?? row?.averageprice
        ?? row?.avg_price
        ?? row?.costPrice
        ?? row?.avgCostPrice,
      );
      const ltp = toNumber(
        row?.ltp
        ?? row?.Ltp
        ?? row?.lastPrice
        ?? row?.lastTradedPrice
        ?? row?.close
        ?? row?.price,
      );
      const unrealized = toNumber(
        row?.pnl
        ?? row?.unrealizedPnl
        ?? row?.unrealized_pnl
        ?? row?.holdingPnl
        ?? row?.holding_pnl
        ?? row?.profitandloss
        ?? row?.profitAndLoss
        ?? row?.profit_and_loss
        ?? row?.mtm
        ?? row?.m2m,
      );
      const computedUnrealized = avgPrice > 0 && ltp > 0 ? (ltp - avgPrice) * netQty : 0;
      return {
        symbol,
        product_type: String(row?.productType || row?.product_type || row?.product || 'INTRADAY').toUpperCase(),
        net_qty: netQty,
        avg_price: avgPrice,
        ltp,
        unrealized_pnl: unrealized || computedUnrealized,
        realized_pnl: toNumber(row?.realizedPnl ?? row?.realized_pnl),
        state: 'OPEN',
      };
    })
    .filter(Boolean);

  const unique = new Map();
  normalized.forEach((row) => {
    unique.set(`${row.symbol}_${row.product_type}`, row);
  });
  return [...unique.values()];
};

const deriveRowsFromDhanOrders = (payload) => {
  const rows = pickArrayRows(payload);
  const bySymbol = new Map();
  rows.forEach((row) => {
    const status = String(row?.orderStatus || row?.status || '').toUpperCase();
    if (!['FILLED', 'PARTIAL', 'COMPLETE'].includes(status)) return;
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
  const fromOrders = liveOrdersResult?.status === 'fulfilled'
    ? deriveRowsFromDhanOrders(liveOrdersResult.value)
    : [];
  const merged = new Map();
  [...fromPositions, ...fromHoldings, ...fromOrders].forEach((row) => {
    merged.set(`${row.symbol}_${row.product_type}`, row);
  });
  return [...merged.values()];
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
 * Resolve holdings for dashboard: fresh broker APIs during market hours; cache otherwise.
 */
export async function resolveDashboardBrokerHoldings(userId, { forceLive = false } = {}) {
  if (!userId) {
    return { authenticated: false, activeBroker: null, rows: [], fromCache: false };
  }

  const cached = readBrokerHoldingsCache(userId);
  const liveRefresh = forceLive || (await shouldRefreshBrokerFromApi());

  if (!liveRefresh && cached?.rows?.length) {
    return {
      authenticated: Boolean(cached.broker),
      activeBroker: cached.broker,
      rows: cached.rows,
      fromCache: true,
    };
  }

  try {
    const fresh = await fetchLiveBrokerHoldingsFromApis(userId);
    if (fresh.rows.length > 0 || liveRefresh) {
      writeBrokerHoldingsCache(userId, fresh.activeBroker, fresh.rows);
      return { ...fresh, fromCache: false };
    }
    if (cached?.rows?.length) {
      return {
        authenticated: Boolean(cached.broker),
        activeBroker: cached.broker,
        rows: cached.rows,
        fromCache: true,
      };
    }
    writeBrokerHoldingsCache(userId, fresh.activeBroker, fresh.rows);
    return { ...fresh, fromCache: false };
  } catch (_) {
    if (cached?.rows?.length) {
      return {
        authenticated: Boolean(cached.broker),
        activeBroker: cached.broker,
        rows: cached.rows,
        fromCache: true,
      };
    }
    return { authenticated: false, activeBroker: null, rows: [], fromCache: false };
  }
}
