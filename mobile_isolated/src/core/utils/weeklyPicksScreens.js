/** Build Screens hub payload for the AI picks tab (matches ScreensHubScreen list shape). */
export function buildAiPicksScreensPayload(picks) {
  const bull = Array.isArray(picks?.bullish) ? picks.bullish : [];
  const bear = Array.isArray(picks?.bearish) ? picks.bearish : [];
  return {
    weeklyMeta: {
      pickDate: picks?.pick_date || picks?.pickDate || null,
      subtitle: 'Weekly AI picks — swing trade setup',
    },
    list: [
      {_hdr: true, _title: 'Bullish swing picks', _tone: 'bull'},
      ...bull.map((r, i) => ({...r, _n: i + 1, _side: 'bull'})),
      {_hdr: true, _title: 'Bearish swing picks', _tone: 'bear'},
      ...bear.map((r, i) => ({...r, _n: i + 1, _side: 'bear'})),
    ],
  };
}

/** True when API returned at least one bullish or bearish pick row. */
export function weeklyPicksHasRows(picks) {
  return Boolean(
    (Array.isArray(picks?.bullish) && picks.bullish.length > 0)
    || (Array.isArray(picks?.bearish) && picks.bearish.length > 0),
  );
}

/**
 * Header-only AI picks lists (2 section titles, zero symbols) must not cache as usable —
 * same bug class as web Chart & Fundamental empty scan cache.
 */
export function aiPicksScreensPayloadUsable(data) {
  if (!data || !Array.isArray(data.list)) return false;
  return data.list.some(
    item => item && !item._hdr && String(item.symbol || item.ticker || '').trim(),
  );
}
