import {
  HOT_ALERT_RETENTION_DAYS,
  ML_ALERT_MIN_SCORE,
  isMlHighConvictionAlert,
  isVwapCrossAlert,
  normalizeLiveAdvisorRows,
} from './alertInboxUtils';

function hoursAgoIso(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

describe('live inbox ML alert policy', () => {
  it('keeps only last 3 days of ML setups scoring at least 0.70 and drops VWAP', () => {
    expect(HOT_ALERT_RETENTION_DAYS).toBe(3);
    expect(ML_ALERT_MIN_SCORE).toBe(0.7);
    expect(isVwapCrossAlert({ alert_type: 'vwap_cross_above' })).toBe(true);

    const kept = normalizeLiveAdvisorRows([
      { id: 1, symbol: 'HAL', alert_type: 'weekly_cross_up_high', timestamp: hoursAgoIso(8), ml_score: 0.81, source: 'ml_setup' },
      { id: 2, symbol: 'TCS', alert_type: 'vwap_cross_below', timestamp: hoursAgoIso(1), ml_score: 0.99, source: 'ml_setup' },
      { id: 3, symbol: 'INFY', alert_type: 'unusual_volume', timestamp: hoursAgoIso(2), ml_score: 0.55, source: 'ml_setup' },
      { id: 4, symbol: 'SBIN', alert_type: 'renko_smart_long', timestamp: hoursAgoIso(24 * 5), ml_score: 0.92, source: 'ml_setup' },
    ]);
    expect(kept.map((row) => row.id)).toEqual(['1']);
    expect(isMlHighConvictionAlert({ alert_type: 'macd_bull', ml_score: 74 })).toBe(true);
  });
});
