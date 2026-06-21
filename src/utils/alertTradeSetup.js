import { brokerRowHasLiveTradingSession, fetchBrokerSetup } from '../api/brokers';
import { placeOrder } from '../api/orders';

export const TRADE_PRODUCT_OPTIONS = [
  { value: 'INTRADAY', label: 'MIS', title: 'MIS (Intraday)', hint: 'Square-off same day' },
  { value: 'MARGIN', label: 'MTF', title: 'MTF (Margin)', hint: 'Margin / MTF product' },
  { value: 'DELIVERY', label: 'Delivery', title: 'Delivery (CNC)', hint: 'Delivery holding' },
];

const BROKER_PRIORITY = ['dhan', 'angelone', 'samco', 'upstox', 'kotak', 'fyers', 'zerodha'];

const parsePrice = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function inferAlertSide(detail) {
  const raw = detail?.raw || {};
  const explicit = String(raw.side || raw.transaction_type || detail?.side || '').toUpperCase();
  if (explicit === 'BUY' || explicit === 'SELL') return explicit;
  const tier = String(raw.buy_sell_tier || '').toUpperCase();
  if (tier.startsWith('S')) return 'SELL';
  if (tier.startsWith('B')) return 'BUY';
  const trend = String(raw.trend || detail?.trend || '').toLowerCase();
  if (trend === 'bearish') return 'SELL';
  const alertType = String(raw.alert_type || detail?.subtitle || '').toLowerCase();
  if (alertType.includes('sell') || alertType.includes('bear') || alertType.includes('exit')) return 'SELL';
  return 'BUY';
}

/** Per-product Entry / SL / targets — aligned with ShortTermPage buildProductProfiles. */
export function buildProductProfilesFromAlertDetail(detail) {
  const levels = detail?.levels || {};
  const raw = detail?.raw || {};
  const entry = parsePrice(levels.entry) || parsePrice(levels.cmp) || parsePrice(raw.cmp) || 0;
  const sl = parsePrice(levels.stopLoss) || 0;
  const baseT1 = parsePrice(levels.target1) || 0;
  const baseT2 = parsePrice(levels.target2) || 0;

  if (!(entry > 0)) {
    return {
      entryPrice: 0,
      byProduct: {
        INTRADAY: { entryPrice: 0, stopLoss: 0, target1: 0, target2: 0 },
        MARGIN: { entryPrice: 0, stopLoss: 0, target1: 0, target2: 0 },
        DELIVERY: { entryPrice: 0, stopLoss: 0, target1: 0, target2: 0 },
      },
    };
  }

  const risk = Math.max(Math.abs(entry - (sl || entry)), Math.max(entry * 0.005, 0.5));
  const direction = baseT1 > 0 ? (baseT1 >= entry ? 1 : -1) : (inferAlertSide(detail) === 'SELL' ? -1 : 1);
  const proj = (r) => Number((entry + direction * r).toFixed(2));
  const pushSL = (mult) => Number((entry - direction * risk * mult).toFixed(2));

  return {
    entryPrice: entry,
    stopLoss: sl || pushSL(1),
    target1: baseT1 || proj(risk),
    target2: baseT2 || proj(risk * 2),
    byProduct: {
      INTRADAY: {
        entryPrice: entry,
        stopLoss: sl || pushSL(1),
        target1: baseT1 || proj(risk),
        target2: baseT2 || proj(risk * 2),
      },
      MARGIN: {
        entryPrice: entry,
        stopLoss: pushSL(1.15),
        target1: baseT2 || proj(risk * 2),
        target2: proj(risk * 3),
      },
      DELIVERY: {
        entryPrice: entry,
        stopLoss: pushSL(1.35),
        target1: parsePrice(raw.target_long_term) || baseT2 || proj(risk * 3),
        target2: proj(risk * 4),
      },
    },
  };
}

export function productOptionsForSide(side) {
  const sideU = String(side || 'BUY').toUpperCase();
  if (sideU === 'SELL') {
    return TRADE_PRODUCT_OPTIONS.filter((opt) => opt.value !== 'MARGIN');
  }
  return TRADE_PRODUCT_OPTIONS;
}

export async function resolveActiveBroker(userId) {
  if (!userId) return null;
  const rows = await fetchBrokerSetup({ userId });
  const arr = Array.isArray(rows) ? rows : [];
  const live = BROKER_PRIORITY
    .map((b) => arr.find((r) => String(r.broker || '').toLowerCase() === b && brokerRowHasLiveTradingSession(r)))
    .find(Boolean);
  if (live?.broker) return String(live.broker).toLowerCase();
  const enabled = BROKER_PRIORITY
    .map((b) => arr.find((r) => String(r.broker || '').toLowerCase() === b && (r.is_enabled || r.token_stored)))
    .find(Boolean);
  return enabled?.broker ? String(enabled.broker).toLowerCase() : 'dhan';
}

export async function placeAlertTrade({
  userId,
  broker,
  symbol,
  side,
  productType,
  profile,
  qty = 1,
  marketPrice,
}) {
  if (!userId) throw new Error('Missing user context');
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) throw new Error('Symbol is required');

  const productKey = String(productType || 'INTRADAY').toUpperCase();
  if (String(side || '').toUpperCase() === 'SELL' && productKey === 'MARGIN') {
    throw new Error('MTF does not support SELL. Choose MIS or Delivery.');
  }

  const productProfile = profile?.byProduct?.[productKey] || profile || {};
  const entry = parsePrice(productProfile.entryPrice) || parsePrice(marketPrice);
  if (!entry) throw new Error('Entry price unavailable for this alert setup');

  const sl = parsePrice(productProfile.stopLoss);
  const t1 = parsePrice(productProfile.target1);
  const t2 = parsePrice(productProfile.target2);

  const payload = {
    user_id: userId,
    broker: broker || 'dhan',
    symbol: sym,
    side: String(side || 'BUY').toUpperCase(),
    product_type: productKey,
    order_type: 'MARKET',
    qty: Math.max(1, Number(qty) || 1),
    price: entry,
    strategy_tag: 'alert_trade',
    strategy_payload: {
      requested_order_type: 'MARKET',
      stop_loss: sl,
      target_1: t1,
      target_2: t2,
      source: 'notification_alert',
    },
  };

  return placeOrder(payload);
}

export function canShowAlertTradeActions(detail) {
  if (!detail?.symbol || detail.symbol === '—') return false;
  if (detail.hasTradeLevels) return true;
  if (detail.isEntryReady || detail.isLiveEntryExit) return true;
  return false;
}
