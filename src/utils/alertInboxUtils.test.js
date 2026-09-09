import {
  HOT_ALERT_RETENTION_DAYS,
  ML_ALERT_MIN_SCORE,
  isInboxItemRead,
  isMlHighConvictionAlert,
  isVwapCrossAlert,
  normalizeLiveAdvisorRows,
  relatedInboxReadKeys,
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
      { id: 5, symbol: 'VARROC', alert_type: 'weekly_cross_up_low', timestamp: hoursAgoIso(2), ml_score: 0.74, source: 'ml_setup' },
      { id: 2, symbol: 'TCS', alert_type: 'vwap_cross_below', timestamp: hoursAgoIso(1), ml_score: 0.99, source: 'ml_setup' },
      { id: 3, symbol: 'INFY', alert_type: 'unusual_volume', timestamp: hoursAgoIso(2), ml_score: 0.55, source: 'ml_setup' },
      { id: 4, symbol: 'SBIN', alert_type: 'renko_smart_long', timestamp: hoursAgoIso(24 * 5), ml_score: 0.92, source: 'ml_setup' },
    ]);
    expect(kept.map((row) => row.id)).toEqual(['5', '1']);
    expect(isMlHighConvictionAlert({ alert_type: 'renko_smart_long', ml_score: 74 })).toBe(true);
    expect(isMlHighConvictionAlert({ alert_type: 'unusual_volume', ml_score: 0.8, vol_ratio: 2.1 })).toBe(true);
    expect(isMlHighConvictionAlert({ alert_type: 'weekly_cross_up_low', ml_score: 0.8 })).toBe(true);
    expect(isMlHighConvictionAlert({ alert_type: 'weekly_cross_up_mid', ml_score: 0.8 })).toBe(true);
    expect(isMlHighConvictionAlert({ alert_type: 'macd_bull', ml_score: 74 })).toBe(false);
  });

  it('treats live and weekly copies of the same id as read together', () => {
    const keys = new Set(relatedInboxReadKeys({ source: 'live', id: 91 }));
    expect(isInboxItemRead({ source: 'weekly_cross', id: 91 }, keys)).toBe(true);
    expect(isInboxItemRead({ source: 'live', id: 92 }, keys)).toBe(false);
  });
});
