import {normSubsectorLabel} from '@core/utils/outlookPayload';

/** Normalize subsector labels for stock lookup (& vs and). */
export function normSubsectorStockMatchKey(name) {
  return normSubsectorLabel(name)
    .replace(/\band\b/g, '&')
    .replace(/\s*&\s*/g, ' & ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Query variants for subsector stock APIs (& vs and, spacing). */
export function subsectorStockQueryVariants(name) {
  const raw = String(name || '').trim();
  if (!raw) return [];

  const variants = new Set([raw]);
  variants.add(raw.replace(/\band\b/gi, '&'));
  variants.add(raw.replace(/&/g, ' and '));
  variants.add(raw.replace(/\s+/g, ' ').trim());

  for (const v of [...variants]) {
    variants.add(v.replace(/\band\b/gi, '&').replace(/\s+/g, ' ').trim());
    variants.add(v.replace(/&/g, ' and ').replace(/\s+/g, ' ').trim());
  }

  return [...variants].filter(Boolean);
}

/** Cache is usable only when the subsector modal has at least one stock row. */
export function hasSubsectorStocksPayload(data) {
  if (!data || typeof data !== 'object') return false;
  const rows = data.rows;
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const total = Number(data.total);
  if (Number.isFinite(total) && total <= 0) return false;
  return true;
}

function dedupeStocks(stocks) {
  const seen = new Set();
  return (stocks || []).filter(stock => {
    const sym = String(stock?.symbol || '').toUpperCase();
    if (!sym || seen.has(sym)) return false;
    seen.add(sym);
    return true;
  });
}

function filterRowsBySubsectorLabel(rows, subsectorName) {
  const needle = normSubsectorStockMatchKey(subsectorName);
  if (!needle) return rows;
  return (rows || []).filter(row => normSubsectorStockMatchKey(row?.subsector) === needle);
}

/**
 * Load paginated stocks for a subsector modal (primary API + legacy fallback).
 * Tries name variants so "Auto and truck dealerships" matches "Auto & Truck Dealerships".
 */
export async function loadSubsectorStocksPage(
  dashboardService,
  subsectorName,
  page = 1,
  pageSize = 25,
  {hydrateMarketFields = false} = {},
) {
  const variants = subsectorStockQueryVariants(subsectorName);
  let lastPaged = {data: [], total: 0, page, pageSize};

  for (const query of variants) {
    const paged = await dashboardService.fetchStocksForSubsector(query, page, pageSize, {
      hydrateMarketFields,
    });
    lastPaged = paged;
    const stocks = dedupeStocks(paged.data);
    if (stocks.length > 0) {
      return {
        rows: stocks,
        total: Number(paged.total || stocks.length),
        page,
        queryUsed: query,
      };
    }
  }

  for (const query of variants) {
    const fallback = await dashboardService.fetchStocksBySubsector(query, 500, {
      hydrateMarketFields,
    });
    let stocks = dedupeStocks(fallback);
    if (stocks.length > 0) {
      stocks = filterRowsBySubsectorLabel(stocks, subsectorName);
      if (stocks.length > 0) {
        const start = (page - 1) * pageSize;
        const pageRows = stocks.slice(start, start + pageSize);
        return {
          rows: pageRows,
          total: stocks.length,
          page,
          queryUsed: query,
        };
      }
    }
  }

  return {
    rows: [],
    total: Number(lastPaged.total || 0),
    page,
    queryUsed: variants[0] || subsectorName,
  };
}
