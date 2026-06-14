function normalizeSymbol(symbol) {
  return String(symbol || '')
    .trim()
    .toUpperCase();
}

function parseNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mergeSignalIntoRow(baseRow, signalRow = {}) {
  const mergedRow = {...baseRow};
  Object.entries(signalRow || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      mergedRow[key] = value;
    }
  });
  return {
    ...mergedRow,
    rsi: parseNumber(mergedRow.rsi ?? mergedRow.rsi_14),
    macd_cross: mergedRow.macd_cross ?? mergedRow.macd_signal ?? mergedRow.macd_state ?? null,
    supertrend_direction: mergedRow.supertrend_direction ?? mergedRow.supertrend ?? mergedRow.ts ?? null,
    volume_ratio: parseNumber(mergedRow.volume_ratio ?? mergedRow.vol_ratio ?? mergedRow.volumeRatio),
  };
}

/** Same merge as web ShortTermPage / LongTermPage watchlist tables. */
export function mergeWatchlistWithSignals(watchlistRows = [], signalRows = []) {
  const sigMap = {};
  (signalRows || []).forEach(s => {
    const sym = normalizeSymbol(s?.symbol);
    if (!sym) return;
    sigMap[sym] = s;
  });

  const rows = (watchlistRows || []).map(row => {
    const sym = normalizeSymbol(row?.symbol);
    return mergeSignalIntoRow({...row, symbol: sym || row?.symbol}, sigMap[sym] || {});
  });

  const bySymbol = new Map();
  for (const row of rows) {
    const sym = normalizeSymbol(row?.symbol);
    if (!sym || bySymbol.has(sym)) continue;
    bySymbol.set(sym, {...row, symbol: sym});
  }
  return Array.from(bySymbol.values());
}
