export const LABEL_FILTER_OPTIONS = [
  { value: '', label: 'All labels' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
  { value: 'no_coverage', label: 'No coverage' },
];

export const CONFIDENCE_FILTER_OPTIONS = [
  { value: '', label: 'All confidence' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'single_source', label: 'Single-source view' },
  { value: 'no_coverage', label: 'No coverage' },
];

export const ORIGIN_FILTER_OPTIONS = [
  { value: '', label: 'All origins' },
  { value: 'domestic', label: 'Domestic' },
  { value: 'foreign', label: 'Foreign' },
];

export const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Score (high to low)' },
  { value: 'score_asc', label: 'Score (low to high)' },
  { value: 'symbol_asc', label: 'Symbol (A–Z)' },
  { value: 'newest_call_desc', label: 'Newest call' },
];

export const PAGE_SIZE_OPTIONS = [25, 50, 100];

export const BROKER_CONSENSUS_DISCLAIMER =
  'Broker Consensus aggregates third-party research opinions from public sources. '
  + 'It is not an AYC investment recommendation and is separate from AYC internal ratings.';

export function consensusLabelDisplay(label) {
  const v = String(label || '').trim().toLowerCase();
  if (v === 'positive') return 'Positive';
  if (v === 'neutral') return 'Neutral';
  if (v === 'negative') return 'Negative';
  if (v === 'no_coverage') return 'No coverage';
  if (!v) return '—';
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function consensusConfidenceDisplay(confidence) {
  const v = String(confidence || '').trim().toLowerCase();
  if (v === 'high') return 'High confidence';
  if (v === 'medium') return 'Medium confidence';
  if (v === 'low') return 'Low confidence';
  if (v === 'single_source') return 'Single-source view';
  if (v === 'no_coverage') return 'No coverage';
  if (!v) return '—';
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildVoteCountsSummary(counts = {}) {
  const pos = counts.positive ?? 0;
  const neu = counts.neutral ?? 0;
  const neg = counts.negative ?? 0;
  return `${pos} positive / ${neu} neutral / ${neg} negative`;
}

export function formatConsensusSummaryLine(item) {
  if (!item) return '';
  return `${consensusLabelDisplay(item.label)} · ${buildVoteCountsSummary(item.counts || {})} · ${consensusConfidenceDisplay(item.confidence)}`;
}

export function isSingleSourceView(item) {
  return String(item?.confidence || '').trim().toLowerCase() === 'single_source';
}

export function isNoCoverage(item) {
  const label = String(item?.label || '').trim().toLowerCase();
  const confidence = String(item?.confidence || '').trim().toLowerCase();
  return label === 'no_coverage' || confidence === 'no_coverage';
}

export function labelChipColors(label) {
  const v = String(label || '').trim().toLowerCase();
  if (v === 'positive') return { bgcolor: '#e8f5e9', color: '#1b5e20' };
  if (v === 'negative') return { bgcolor: '#ffebee', color: '#c62828' };
  if (v === 'neutral') return { bgcolor: '#fff8e1', color: '#f57f17' };
  if (v === 'no_coverage') return { bgcolor: '#eceff1', color: '#546e7a' };
  return { bgcolor: '#f5f5f5', color: '#666' };
}

export function normalizedRatingDisplay(rating) {
  const v = String(rating || '').trim().toLowerCase();
  if (v === 'positive') return 'Positive';
  if (v === 'neutral') return 'Neutral';
  if (v === 'negative') return 'Negative';
  return rating || '—';
}

export function originDisplay(origin) {
  const v = String(origin || '').trim().toLowerCase();
  if (v === 'domestic') return 'Domestic';
  if (v === 'foreign') return 'Foreign';
  return origin || '—';
}

export function formatBrokerPrice(value, currency = 'INR') {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const cur = String(currency || 'INR').toUpperCase();
  if (cur === 'INR') {
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUpsidePct(value) {
  if (value == null || value === '' || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatIsoDate(value) {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function buildBrokerConsensusQueryParams(filters = {}) {
  const params = {
    sort: String(filters.sort || 'score_desc'),
    page: Math.max(1, Number(filters.page) || 1),
    page_size: Math.min(200, Math.max(1, Number(filters.page_size) || 50)),
  };
  const search = String(filters.search || '').trim();
  if (search) params.search = search;
  const label = String(filters.label || '').trim().toLowerCase();
  if (label) params.label = label;
  const origin = String(filters.origin || '').trim().toLowerCase();
  if (origin) params.origin = origin;
  const confidence = String(filters.confidence || '').trim().toLowerCase();
  if (confidence) params.confidence = confidence;
  return params;
}

/** Allow only http/https external links in broker attribution UI. */
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

/** Stable React row key for institution recommendations (avoids date-only collisions). */
export function buildBrokerConsensusRecommendationRowKey(rec, index = 0) {
  const parts = [
    String(rec?.institution_name || '').trim(),
    String(rec?.recommendation_date || '').trim(),
    String(rec?.normalized_rating || rec?.original_rating || '').trim(),
    rec?.target_price != null ? String(rec.target_price) : '',
    String(rec?.origin || '').trim(),
    String(rec?.source_url || '').trim(),
  ].filter(Boolean);
  if (parts.length) return parts.join('|');
  return `rec-${index}`;
}
