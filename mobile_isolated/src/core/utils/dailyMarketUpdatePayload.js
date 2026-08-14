/** Normalize GET /api/daily-market-update for web + mobile Daily Update report. */

export function normalizeDailyMarketUpdatePayload(raw) {
  const breadth = raw?.breadth || {};
  const pulse = raw?.sector_pulse || raw?.sectorPulse || {};
  const fresh = raw?.fresh_signals || raw?.freshSignals || {};
  const narratives = raw?.narratives || {};

  const mapCard = (c) => ({
    code: String(c?.code || c?.name || '').trim(),
    name: String(c?.name || c?.code || '').trim(),
    value: c?.value == null ? null : Number(c.value),
    pct: c?.pct == null ? null : Number(c.pct),
  });

  return {
    ok: raw?.ok !== false,
    asOfLabel: raw?.as_of_label || raw?.asOfLabel || '',
    lastUpdatedIst: raw?.last_updated_ist || raw?.lastUpdatedIst || '',
    generatedAt: raw?.generated_at || raw?.generatedAt || null,
    title: raw?.title || 'What happened in the market today',
    brand: raw?.brand || 'AYC Stock Weekly Research',
    breadth: {
      advances: Number(breadth.advances || 0),
      declines: Number(breadth.declines || 0),
      unchanged: Number(breadth.unchanged || 0),
      total: Number(breadth.total || 0),
      advancesPct: Number(breadth.advances_pct ?? breadth.advancesPct ?? 0),
      declinesPct: Number(breadth.declines_pct ?? breadth.declinesPct ?? 0),
      unchangedPct: Number(breadth.unchanged_pct ?? breadth.unchangedPct ?? 0),
      advanceDeclineRatio:
        breadth.advance_decline_ratio == null && breadth.advanceDeclineRatio == null
          ? null
          : Number(breadth.advance_decline_ratio ?? breadth.advanceDeclineRatio),
    },
    sectorPulse: {
      topGainers: (pulse.top_gainers || pulse.topGainers || []).map(mapCard).filter((c) => c.code),
      topLosers: (pulse.top_losers || pulse.topLosers || []).map(mapCard).filter((c) => c.code),
      lead: pulse.lead ? mapCard(pulse.lead) : null,
      drag: pulse.drag ? mapCard(pulse.drag) : null,
    },
    indexCards: (raw?.index_cards || raw?.indexCards || []).map(mapCard).filter((c) => c.code),
    volumeLeaders: (raw?.volume_leaders || raw?.volumeLeaders || []).map((v) => ({
      symbol: String(v?.symbol || '').trim().toUpperCase(),
      volume: Number(v?.volume || 0),
      price: v?.price == null ? null : Number(v.price),
      day1d: v?.day1d == null ? null : Number(v.day1d),
    })).filter((v) => v.symbol),
    freshSignals: {
      B1: Number(fresh.B1 || 0),
      B2: Number(fresh.B2 || 0),
      B3: Number(fresh.B3 || 0),
      S1: Number(fresh.S1 || 0),
      S2: Number(fresh.S2 || 0),
      S3: Number(fresh.S3 || 0),
    },
    narratives: {
      headline: narratives.headline || '',
      executiveSummary: narratives.executive_summary || narratives.executiveSummary || '',
      marketSnapshot: narratives.market_snapshot || narratives.marketSnapshot || '',
      indexPerformance: narratives.index_performance || narratives.indexPerformance || '',
      sectorPulse: narratives.sector_pulse || narratives.sectorPulse || '',
      whatDroveAction: narratives.what_drove_action || narratives.whatDroveAction || '',
      volumeBreadth: narratives.volume_breadth || narratives.volumeBreadth || '',
      whatToWatch: narratives.what_to_watch || narratives.whatToWatch || '',
      freshSignals: narratives.fresh_signals || narratives.freshSignals || '',
      disclaimer: narratives.disclaimer || '',
    },
  };
}

/** Split `**bold**` markers into text nodes for React. */
export function splitBoldSegments(text) {
  const s = String(text || '');
  const parts = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push({ bold: false, text: s.slice(last, m.index) });
    parts.push({ bold: true, text: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ bold: false, text: s.slice(last) });
  if (!parts.length) parts.push({ bold: false, text: s });
  return parts;
}

export function formatInrVolume(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('en-IN');
}

export function formatInrPrice(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatIndexValue(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPctDelta(pct) {
  const v = Number(pct);
  if (!Number.isFinite(v)) return { text: '—', positive: null };
  const positive = v >= 0;
  const arrow = positive ? '↑' : '↓';
  const sign = positive ? '+' : '';
  return { text: `${arrow} ${sign}${v.toFixed(2)}%`, positive };
}
