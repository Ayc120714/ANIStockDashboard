import {extractOutlookRows, formatIndexValue, parsePercentLike} from '@core/utils/outlookPayload';

const INDEX_PRIORITIES = [
  'nifty 50',
  'nifty next 50',
  'nifty midcap 100',
  'nifty midcap 50',
  'nifty bank',
];

const SMALLCAP_PRIORITIES = [
  'nifty smlcap 100',
  'nifty smallcap 100',
  'nifty smallcap 50',
  'nifty microcap 250',
  'india vix',
];

function deriveTrend(item) {
  const chg =
    item?.perf_1d ??
    item?.percentage_change ??
    item?.percentageChange ??
    item?.change_pct ??
    item?.changePercent;
  const num = parsePercentLike(chg);
  if (num == null) return {label: 'SIDEWAYS', direction: 'sideways'};
  if (Math.abs(num) <= 0.05) return {label: 'SIDEWAYS', direction: 'sideways'};
  if (num > 0.05) return {label: 'UP TREND', direction: 'up'};
  return {label: 'DOWN TREND', direction: 'down'};
}

function mapCard(item, idx = 0) {
  if (!item || typeof item !== 'object') return null;
  const name = item.title ?? item.name ?? item.index ?? item.label ?? '';
  if (!name) return null;
  const trend = deriveTrend(item);
  const dayNum = parsePercentLike(item?.perf_1d);
  const rawValue = item.value ?? item.cmp ?? item.close ?? item.last ?? item.level ?? item.ltp;
  return {
    id: item.id ?? idx + 1,
    name,
    symbol: name,
    trend: trend.label,
    trendDirection: trend.direction,
    value: formatIndexValue(rawValue),
    ltp: rawValue,
    day1d:
      dayNum != null
        ? `${dayNum >= 0 ? '+' : ''}${dayNum.toFixed(2)}%`
        : '—',
    day1dNum: dayNum,
  };
}

function pickByPriority(source, priorities, max = 3) {
  const picked = [];
  const used = new Set();
  for (const pattern of priorities) {
    const hit = source.find(item => {
      const n = String(item?.name || item?.title || '').toLowerCase();
      if (!n || used.has(n)) return false;
      return n.includes(pattern);
    });
    if (hit) {
      picked.push(hit);
      used.add(String(hit?.name || hit?.title || '').toLowerCase());
    }
  }
  return picked.slice(0, max);
}

/** Same index card selection as web `fetchMarketIndices` — flattened for `MarketIndexCardsRow`. */
export function normalizeMarketIndicesCards(payload) {
  const source = extractOutlookRows(payload);
  if (!source.length) return [];
  const indexCards = pickByPriority(source, INDEX_PRIORITIES, 3);
  const smallcapCards = pickByPriority(source, SMALLCAP_PRIORITIES, 3);
  return [...indexCards, ...smallcapCards].map(mapCard).filter(Boolean);
}
