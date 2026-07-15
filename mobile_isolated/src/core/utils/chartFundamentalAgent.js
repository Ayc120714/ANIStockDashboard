import {CHART_FUNDAMENTAL_BLOCKS} from '@core/utils/chartFundamentalTables';
import {formatAdvisorRsPct} from '@core/utils/advisorWebParity';
import {mapFiiHoldingFields} from '@core/utils/fiiHoldingTrend';

function resolveRsValue(row, block) {
  const primary = row?.[block.rsField];
  if (primary != null && !Number.isNaN(Number(primary))) return primary;
  if (block.id === 'monthly') {
    const alt = row?.rs_monthly_12;
    if (alt != null && !Number.isNaN(Number(alt))) return alt;
  }
  return null;
}

function mapAgentRow(row, block) {
  const rs = resolveRsValue(row, block);
  return {
    symbol: row?.symbol,
    sector: row?.sector || '—',
    close: row?.close ?? row?.weekly_close ?? row?.monthly_close,
    prevClose: row?.weekly_close_prev ?? row?.monthly_close_prev ?? row?.prev_week_close,
    rs,
    rsLabel: formatAdvisorRsPct(rs),
    diPlus: row?.di_plus,
    rating: String(row?.rating || '—').replace(/_/g, ' '),
    horizon: String(row?.horizon || '—').replace(/_/g, ' '),
    passed_all: row?.passed_all,
    ...mapFiiHoldingFields(row),
  };
}

const AGENT_DATA_KEYS = {
  daily: 'data',
  weekly: 'weekly_data',
  monthly: 'monthly_data',
};

/** Map `/advisor/signals/chart-fundamental-agent` payload to mobile chart blocks. */
export function buildChartAgentBlocks(payload) {
  const scanned = Number(payload?.symbol_limit || payload?.scanned || 0);
  return CHART_FUNDAMENTAL_BLOCKS.map(block => {
    const raw = payload?.[AGENT_DATA_KEYS[block.id]] || [];
    const rows = raw
      .filter(r => resolveRsValue(r, block) != null)
      .map(r => mapAgentRow(r, block))
      .sort((a, b) => Number(b.rs) - Number(a.rs));
    return {
      ...block,
      rows,
      matchCount: rows.length,
      scanned: scanned || raw.length,
    };
  });
}
