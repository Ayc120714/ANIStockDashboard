/** Pre-trade checks aligned with web OrderPanel + backend orders.py margin logic. */

export const TRADE_PRODUCT_OPTIONS = [
  {value: 'INTRADAY', label: 'MIS (Intraday)'},
  {value: 'MARGIN', label: 'MTF (Margin)'},
  {value: 'DELIVERY', label: 'Delivery (CNC)'},
];

export const BROKER_LEVERAGE = {
  dhan: {INTRADAY: 5, MARGIN: 4, DELIVERY: 1, MTF: 4},
  angelone: {INTRADAY: 5, MARGIN: 4, DELIVERY: 1, MTF: 4},
  samco: {INTRADAY: 5, MARGIN: 4, DELIVERY: 1, MTF: 4},
  upstox: {INTRADAY: 5, MARGIN: 4, DELIVERY: 1, MTF: 4},
  kotak: {INTRADAY: 5, MARGIN: 4, DELIVERY: 1, MTF: 4},
  fyers: {INTRADAY: 5, MARGIN: 4, DELIVERY: 1, MTF: 4},
  zerodha: {INTRADAY: 5, MARGIN: 4, DELIVERY: 1, MTF: 4},
};

export function brokerRowHasLiveTradingSession(row) {
  if (!row) return false;
  const broker = String(row.broker || '').toLowerCase();
  if (broker === 'dhan') {
    return Boolean(row.has_session || row.token_stored || row.live_enabled);
  }
  return Boolean(row.live_enabled ?? row.has_session);
}

export function pickConnectedBrokerRow(rows, preferred) {
  const list = Array.isArray(rows) ? rows : [];
  const pref = String(preferred || '').toLowerCase();
  if (pref) {
    const match = list.find(r => String(r.broker || '').toLowerCase() === pref);
    if (match && brokerRowHasLiveTradingSession(match)) return match;
  }
  return list.find(r => brokerRowHasLiveTradingSession(r)) || null;
}

export function normalizeProductType(productType) {
  const p = String(productType || 'INTRADAY').toUpperCase();
  if (p === 'MTF') return 'MARGIN';
  return p;
}

export function productTypeLabel(productType) {
  const key = normalizeProductType(productType);
  if (key === 'MARGIN') return 'MTF (Margin)';
  if (key === 'DELIVERY') return 'Delivery (CNC)';
  return 'MIS (Intraday)';
}

export function shouldCheckFunds(side, productType) {
  const sideU = String(side || 'BUY').toUpperCase();
  const productU = normalizeProductType(productType);
  return sideU === 'BUY' || (sideU === 'SELL' && productU === 'INTRADAY');
}

export function resolveLeverage(broker, productType) {
  const brokerKey = String(broker || 'dhan').toLowerCase();
  const productKey = normalizeProductType(productType);
  const map = BROKER_LEVERAGE[brokerKey] || BROKER_LEVERAGE.dhan;
  return Number(map[productKey] || map.INTRADAY || 1);
}

export function estimateRequiredMargin({broker, productType, qty, price}) {
  const quantity = Math.max(1, Number(qty || 1));
  const entry = Number(price);
  if (!Number.isFinite(entry) || entry <= 0) {
    return null;
  }
  const leverage = Math.max(1, resolveLeverage(broker, productType));
  const turnover = entry * quantity;
  return {
    turnover,
    leverage,
    requiredAmount: turnover / leverage,
  };
}

export function fundsSufficient(availableAmount, requiredAmount) {
  const available = Number(availableAmount);
  const required = Number(requiredAmount);
  if (!Number.isFinite(required) || required <= 0) return true;
  if (!Number.isFinite(available)) return null;
  return available + 1e-9 >= required;
}

export function inferAlertSide(alert) {
  const explicit = String(alert?.side || alert?.transaction_type || '').toUpperCase();
  if (explicit === 'BUY' || explicit === 'SELL') return explicit;
  const tier = String(alert?.buy_sell_tier || '').toUpperCase();
  if (tier.startsWith('S')) return 'SELL';
  if (tier.startsWith('B')) return 'BUY';
  const trend = String(alert?.trend || '').toLowerCase();
  if (trend === 'bearish') return 'SELL';
  return 'BUY';
}

export function buildOrdersRouteFromAlert(alert, {productType, side} = {}) {
  return {
    fromAlert: {
      id: alert?.id,
      symbol: alert?.symbol,
      entry_price: alert?.entry_price,
      stop_loss: alert?.stop_loss,
      target_1: alert?.target_1,
      target_2: alert?.target_2,
      source: alert?.source || alert?.alert_type || 'advisor_alert',
      side: side || inferAlertSide(alert),
    },
    symbol: alert?.symbol,
    side: side || inferAlertSide(alert),
    productType: normalizeProductType(productType || 'INTRADAY'),
    requirePreflight: true,
  };
}
