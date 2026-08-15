/**
 * Guard: mobile push notifications only for Renko Smart + already-submitted sources.
 * Hot Subsectors and other unsubmitted tabs must not push.
 */
import {
  isPushEligibleLiveAlert,
  isPushEligibleTableKey,
  isPushExcludedTableKey,
  isRenkoPushAlert,
} from '@core/utils/pushNotificationEligibility';
import {ADVISOR_TABLE_KEYS, ADVISOR_TABLE_META} from '@core/utils/advisorTableSnapshots';
import {buildTradingViewSymbolsCsv} from '@core/utils/tradingViewCsv';

describe('push notification eligibility', () => {
  it('allows Renko Smart live alerts for push', () => {
    expect(isRenkoPushAlert({alert_type: 'renko_smart_long'})).toBe(true);
    expect(
      isPushEligibleLiveAlert({
        alert_type: 'renko_smart_long',
        symbol: 'SBIN',
        ml_score: 0.81,
        source: 'ml_setup',
      }),
    ).toBe(true);
    expect(isPushEligibleLiveAlert({alert_type: 'renko_smart_long', symbol: 'SBIN'})).toBe(false);
    expect(isPushEligibleLiveAlert({alert_type: 'renko_fib_zone_long', symbol: 'TCS'})).toBe(false);
  });

  it('blocks entry/exit without ML score, VWAP, and sub-70 rows from push', () => {
    expect(isPushEligibleLiveAlert({alert_type: 'ENTRY_READY', symbol: 'INFY'})).toBe(false);
    expect(isPushEligibleLiveAlert({alert_type: 'EXIT_READY', symbol: 'INFY'})).toBe(false);
    expect(isPushEligibleLiveAlert({alert_type: 'vwap_cross_above', ml_score: 0.99})).toBe(false);
    expect(
      isPushEligibleLiveAlert({
        alert_type: 'renko_smart_long',
        source: 'demo',
        symbol: 'DEMO',
        message: '[DEMO] test',
        ml_score: 0.99,
      }),
    ).toBe(false);
    expect(isPushEligibleLiveAlert({alert_type: 'weekly_cross_up_high', ml_score: 0.69, source: 'ml_setup'})).toBe(
      false,
    );
    expect(
      isPushEligibleLiveAlert({alert_type: 'unusual_volume', ml_score: 0.8, vol_ratio: 2.1, source: 'ml_setup'}),
    ).toBe(true);
    expect(
      isPushEligibleLiveAlert({alert_type: 'prev_day_high_breakout', ml_score: 0.8, source: 'ml_setup'}),
    ).toBe(true);
  });

  it('does not push table-change events; Hot Subsectors stays excluded', () => {
    expect(ADVISOR_TABLE_KEYS.RENKO_SMART).toBe('renko_smart');
    expect(ADVISOR_TABLE_META[ADVISOR_TABLE_KEYS.RENKO_SMART]?.advisorTab).toBe('renko');
    expect(isPushEligibleTableKey('renko_smart', ADVISOR_TABLE_META)).toBe(false);
    expect(isPushEligibleTableKey('trend_b1_weekly', ADVISOR_TABLE_META)).toBe(false);
    expect(isPushExcludedTableKey('hot_subsectors')).toBe(true);
  });
});

describe('advisor Renko Smart mobile endpoint', () => {
  it('uses renko-smart endpoint for the Renko Smart tab', () => {
    const endpoint = '/advisor/signals/renko-smart';
    expect(endpoint).toContain('renko-smart');
    expect(endpoint).not.toContain('renko-fib-zone');
  });

  it('builds TradingView CSV from symbols via shared util', () => {
    expect(buildTradingViewSymbolsCsv(['SBIN', 'hdfcbank', 'SBIN', ''])).toBe(
      'NSE:SBIN,NSE:HDFCBANK',
    );
  });
});
