import {Linking} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';
import {formatINR} from '@core/utils/formatMarket';

export const BROKER_CONSENSUS_PAGE_SIZE = 20;

export const BROKER_CONSENSUS_DISCLAIMER =
  'Aggregates third-party broker research opinions. This is not an AYC investment recommendation.';

export const BROKER_CONSENSUS_LABEL_OPTIONS = [
  {id: '', label: 'All labels'},
  {id: 'positive', label: 'Positive'},
  {id: 'neutral', label: 'Neutral'},
  {id: 'negative', label: 'Negative'},
  {id: 'no_coverage', label: 'No coverage'},
];

export const BROKER_CONSENSUS_ORIGIN_OPTIONS = [
  {id: '', label: 'All origins'},
  {id: 'domestic', label: 'Domestic'},
  {id: 'foreign', label: 'Foreign'},
];

export const BROKER_CONSENSUS_CONFIDENCE_OPTIONS = [
  {id: '', label: 'All confidence'},
  {id: 'high', label: 'High'},
  {id: 'medium', label: 'Medium'},
  {id: 'low', label: 'Low'},
  {id: 'single_source', label: 'Single source'},
  {id: 'no_coverage', label: 'No coverage'},
];

export const BROKER_CONSENSUS_SORT_OPTIONS = [
  {id: 'score_desc', label: 'Score (high to low)'},
  {id: 'score_asc', label: 'Score (low to high)'},
  {id: 'newest_call_desc', label: 'Newest call'},
  {id: 'symbol_asc', label: 'Symbol A–Z'},
];

const LABEL_COPY = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  no_coverage: 'No coverage',
};

const CONFIDENCE_COPY = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  single_source: 'Single source',
  no_coverage: 'No coverage',
};

export function formatBrokerConsensusLabel(label) {
  const key = String(label || '').trim().toLowerCase();
  return LABEL_COPY[key] || 'Unknown';
}

export function formatBrokerConsensusConfidence(confidence) {
  const key = String(confidence || '').trim().toLowerCase();
  return CONFIDENCE_COPY[key] || 'Unknown';
}

export function getBrokerConsensusLabelTone(label) {
  const key = String(label || '').trim().toLowerCase();
  if (key === 'positive') return AYC.positive;
  if (key === 'negative') return AYC.negative;
  if (key === 'neutral') return AYC.warning;
  return AYC.textMuted;
}

export function getBrokerConsensusConfidenceTone(confidence) {
  const key = String(confidence || '').trim().toLowerCase();
  if (key === 'high') return AYC.positive;
  if (key === 'medium') return AYC.accent;
  if (key === 'single_source') return AYC.warning;
  if (key === 'no_coverage') return AYC.textMuted;
  return AYC.textMuted;
}

export function formatBrokerConsensusScore(score) {
  if (score == null || Number.isNaN(Number(score))) return '—';
  return Number(score).toFixed(2);
}

export function formatBrokerConsensusCounts(counts = {}) {
  const pos = Number(counts.positive || 0);
  const neu = Number(counts.neutral || 0);
  const neg = Number(counts.negative || 0);
  const total = Number(counts.total ?? pos + neu + neg);
  if (!total) return 'No active calls';
  return `+${pos} / ~${neu} / −${neg} · ${total} total`;
}

export function formatBrokerConsensusTarget(target = {}) {
  const mean = target?.mean;
  const upside = target?.implied_upside_pct;
  const parts = [];
  if (mean != null && !Number.isNaN(Number(mean))) {
    parts.push(`Target ${formatINR(mean)}`);
  }
  if (upside != null && !Number.isNaN(Number(upside))) {
    const n = Number(upside);
    parts.push(`${n > 0 ? '+' : ''}${n.toFixed(1)}% upside`);
  }
  return parts.length ? parts.join(' · ') : 'Target unavailable';
}

export function formatBrokerConsensusDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return raw.slice(0, 10);
}

export function formatBrokerConsensusOrigin(origin) {
  const key = String(origin || '').trim().toLowerCase();
  if (key === 'domestic') return 'Domestic';
  if (key === 'foreign') return 'Foreign';
  return 'Unknown';
}

export function isNoCoverageItem(item) {
  const label = String(item?.label || '').trim().toLowerCase();
  const confidence = String(item?.confidence || '').trim().toLowerCase();
  return label === 'no_coverage' || confidence === 'no_coverage';
}

export function isSingleSourceView(item) {
  return String(item?.confidence || '').trim().toLowerCase() === 'single_source';
}

export function buildBrokerConsensusQuery(filters = {}) {
  const params = {};
  const search = String(filters.search || '').trim();
  if (search) params.search = search;
  if (filters.label) params.label = String(filters.label).trim().toLowerCase();
  if (filters.origin) params.origin = String(filters.origin).trim().toLowerCase();
  if (filters.confidence) params.confidence = String(filters.confidence).trim().toLowerCase();
  params.sort = filters.sort || 'score_desc';
  params.page = Math.max(1, Number(filters.page || 1));
  params.page_size = Math.min(200, Math.max(1, Number(filters.page_size || BROKER_CONSENSUS_PAGE_SIZE)));
  return params;
}

export function parseBrokerConsensusListResponse(resp) {
  const items = Array.isArray(resp?.items) ? resp.items : [];
  return {
    items,
    total: Number(resp?.total || items.length || 0),
    page: Number(resp?.page || 1),
    page_size: Number(resp?.page_size || BROKER_CONSENSUS_PAGE_SIZE),
    as_of: resp?.as_of || null,
  };
}

export function parseBrokerConsensusDetailResponse(resp) {
  return {
    summary: resp?.summary || null,
    recommendations: Array.isArray(resp?.recommendations) ? resp.recommendations : [],
  };
}

export function hasMoreBrokerConsensusPages({page = 1, page_size = BROKER_CONSENSUS_PAGE_SIZE, total = 0} = {}) {
  return page * page_size < total;
}

export function mergeBrokerConsensusPages(existing = [], incoming = []) {
  const seen = new Set(existing.map(row => String(row?.symbol || '').trim().toUpperCase()).filter(Boolean));
  const merged = [...existing];
  for (const row of incoming) {
    const sym = String(row?.symbol || '').trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    merged.push(row);
  }
  return merged;
}

export function canOpenExternalHttpUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function openExternalHttpUrl(url, linking = Linking) {
  if (!canOpenExternalHttpUrl(url)) return false;
  try {
    const supported = await linking.canOpenURL(url);
    if (!supported) return false;
    await linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
