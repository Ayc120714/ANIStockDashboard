import {parseSortNumber} from '@core/utils/tableSort';
import {stockRowPct} from '@core/utils/stockListPayload';

export function getScreenSortValue(row, key, {main, perM, perV} = {}) {
  switch (key) {
    case 'symbol':
      return String(row?.symbol || row?.ticker || '').toUpperCase();
    case 'sector':
      return String(row?.sector || row?.subsector || '');
    case 'market_cap':
    case 'mc':
      return parseSortNumber(row?.market_cap ?? row?.mc);
    case 'chg':
    case 'change_pct':
      return stockRowPct(row) ?? parseSortNumber(row?.chg ?? row?.change_pct);
    case 'price':
    case 'cmp':
      return parseSortNumber(row?.price ?? row?.cmp ?? row?.ltp);
    case 'ema21':
      return parseSortNumber(row?.ema21);
    case 'volume':
      return parseSortNumber(row?.volume);
    case 'volume_jump': {
      const v = row?.volume;
      const a = row?.avg_volume;
      if (v && a && Number(a) > 0) return Number(v) / Number(a);
      return parseSortNumber(row?.percent_change_volume_1d ?? row?.percent_change_volume_1w);
    }
    case 'relative_strength':
    case 'rs':
      return parseSortNumber(row?.relative_strength);
    case 'week1w':
      return parseSortNumber(row?.week1w ?? row?.week_1w);
    case 'status':
      return String(row?.status || '');
    case 'listing_gain':
    case 'gain':
      return parseSortNumber(row?.listing_gain);
    case 'issue_price':
    case 'list':
      return parseSortNumber(row?.issue_price);
    case 'current_price':
      return parseSortNumber(row?.current_price);
    case 'grade':
      return String(row?.grade || '');
    case 'entry_price':
      return parseSortNumber(row?.entry_price);
    case 'recommendation':
      return String(row?.recommendation || '');
    default:
      if (main === 'movers' && (key === 'day1d' || key === 'week1w' || key === 'month1m')) {
        return stockRowPct(row, perM === 'week' ? 'week' : perM === 'month' ? 'month' : 'day');
      }
      if (main === 'volume' && (key === 'day1d' || key === 'week1w' || key === 'month1m')) {
        return stockRowPct(row, perV === 'week' ? 'week' : perV === 'month' ? 'month' : 'day');
      }
      return row?.[key] ?? '';
  }
}

export function getSectorSortValue(row, key) {
  switch (key) {
    case 'name':
      return String(row?.name || row?.symbol || '');
    case 'trend':
      return String(row?.trend || '');
    case 'day1d':
      return row?.day1dNum ?? parseSortNumber(row?.day1d);
    case 'week1w':
      return row?.week1wNum ?? parseSortNumber(row?.week1w);
    case 'month1m':
      return row?.month1mNum ?? parseSortNumber(row?.month1m);
    default:
      return row?.[key] ?? '';
  }
}

export function getWatchlistSortValue(row, key, listType) {
  switch (key) {
    case 'symbol':
      return String(row?.symbol || '').toUpperCase();
    case 'price':
      return parseSortNumber(row?.price);
    case 'day1d':
      return stockRowPct(row);
    case 'buy_sell_tier':
      return String(row?.buy_sell_tier || '');
    case 'rsi':
      return parseSortNumber(row?.rsi);
    case 'composite_score':
    case 'score':
      return parseSortNumber(row?.composite_score);
    case 'recommendation':
      return String(row?.recommendation || '');
    case 'trend':
      return String(row?.trend || '');
    case 'entry':
      return parseSortNumber(row?.entry_price ?? row?.target_short_term ?? row?.target_long_term);
    default:
      return listType === 'short_term' ? row?.[key] : row?.[key];
  }
}

export function getSubsectorSortValue(row, key) {
  const sub = row?.sub || row;
  switch (key) {
    case 'name':
      return String(sub?.name || row?.name || sub?.subsector || '');
    case 'performance':
    case 'all':
      return typeof sub?.all === 'number' && Number.isFinite(sub.all)
        ? sub.all
        : row?.allNum ?? parseSortNumber(sub?.all);
    case 'week0':
      return row?.week0Num ?? parseSortNumber(sub?.week0);
    case 'week1':
      return row?.week1Num ?? parseSortNumber(sub?.week1);
    default:
      if (sub && Object.prototype.hasOwnProperty.call(sub, key)) {
        return parseSortNumber(sub[key]);
      }
      return row?.[key] ?? '';
  }
}

export function getMarketIndexSortValue(row, key) {
  switch (key) {
    case 'name':
      return String(row?.name || row?.symbol || '');
    case 'day1d':
      return row?.day1dNum ?? parseSortNumber(row?.day1d ?? row?.change_pct ?? row?.pct_change);
    case 'week1w':
      return row?.week1wNum ?? parseSortNumber(row?.week1w);
    case 'month1m':
      return row?.month1mNum ?? parseSortNumber(row?.month1m ?? row?.month_1m);
    case 'trend':
      return String(row?.trend || '');
    default:
      return row?.[key] ?? '';
  }
}

export function getAdvisorSortValue(row, key) {
  switch (key) {
    case 'symbol':
      return String(row?.symbol || '').toUpperCase();
    case 'sector':
      return String(row?.sector || '');
    case 'cmp':
    case 'price':
      return parseSortNumber(row?.cmp ?? row?.price);
    case 'status':
      return String(row?.status || '');
    case 'rsi':
    case 'current_value':
      return parseSortNumber(row?.current_value ?? row?.rsi);
    case 'analysis_type':
      return String(row?.analysis_type || '');
    case 'trend':
      return String(row?.trend || '');
    case 'score':
    case 'conviction_score':
      return parseSortNumber(row?.conviction_score ?? row?.signal_score ?? row?.score);
    case 'buy_sell_tier':
    case 'tier':
      return String(row?.buy_sell_tier || '');
    case 'close':
      return parseSortNumber(row?.close ?? row?.cmp ?? row?.price);
    case 'chg':
      return parseSortNumber(row?.chg ?? row?.day1d ?? row?.change_pct);
    case 'entry_price':
      return parseSortNumber(row?.entry_price);
    case 'stop_loss':
      return parseSortNumber(row?.stop_loss);
    case 'target_1':
      return parseSortNumber(row?.target_1);
    case 'rating':
      return String(row?.rating || '');
    case 'confidence':
      return parseSortNumber(row?.confidence);
    case 'date':
      return String(row?.created_at || row?.date || '');
    default:
      return row?.[key] ?? '';
  }
}
