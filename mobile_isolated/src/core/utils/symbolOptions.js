import {useMemo} from 'react';
import {extractApiRows} from '@core/utils/apiPayload';

export function normalizeSymbolOption(item) {
  if (typeof item === 'string') {
    const symbol = item.trim().toUpperCase();
    return symbol ? {symbol, label: symbol, sector: ''} : null;
  }
  const symbol = String(item?.symbol || item?.ticker || '').trim().toUpperCase();
  if (!symbol) return null;
  const sector = String(item?.sector || '').trim();
  const subsector = String(item?.subsector || '').trim();
  const suffix = sector ? ` — ${sector}` : subsector ? ` — ${subsector}` : '';
  return {symbol, label: `${symbol}${suffix}`, sector, subsector};
}

export function mergeSymbolOptions(...sources) {
  const map = new Map();
  for (const source of sources) {
    const rows = Array.isArray(source) ? source : extractApiRows(source);
    for (const row of rows) {
      const opt = normalizeSymbolOption(row);
      if (opt && !map.has(opt.symbol)) map.set(opt.symbol, opt);
    }
  }
  return [...map.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function filterSymbolOptions(options, query, limit = 24) {
  const q = String(query || '').trim().toUpperCase();
  if (!q) return options.slice(0, limit);
  return options
    .filter(
      opt =>
        opt.symbol.includes(q) ||
        opt.label.toUpperCase().includes(q) ||
        String(opt.sector || '').toUpperCase().includes(q) ||
        String(opt.subsector || '').toUpperCase().includes(q),
    )
    .slice(0, limit);
}

export function useMergedSymbolOptions(apiRows, extraSymbols = []) {
  return useMemo(() => {
    const extras = extraSymbols.map(s => String(s || '').trim().toUpperCase()).filter(Boolean);
    return mergeSymbolOptions(apiRows, extras);
  }, [apiRows, extraSymbols]);
}
