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
    expect(isPushEligibleLiveAlert({alert_type: 'renko_smart_long', symbol: 'SBIN'})).toBe(true);
    expect(isPushEligibleLiveAlert({alert_type: 'renko_fib_zone_long', symbol: 'TCS'})).toBe(true);
  });

  it('allows already-submitted entry/exit live alerts for push', () => {
    expect(isPushEligibleLiveAlert({alert_type: 'ENTRY_READY', symbol: 'INFY'})).toBe(true);
    expect(isPushEligibleLiveAlert({alert_type: 'EXIT_READY', symbol: 'INFY'})).toBe(true);
  });

  it('blocks demo alerts and non-submitted alert types from push', () => {
    expect(
      isPushEligibleLiveAlert({
        alert_type: 'renko_smart_long',
        source: 'demo',
        symbol: 'DEMO',
        message: '[DEMO] test',
      }),
    ).toBe(false);
    expect(isPushEligibleLiveAlert({alert_type: 'hot_subsectors_scan', symbol: 'SBIN'})).toBe(false);
    expect(isPushEligibleLiveAlert({alert_type: 'indicator_5m_rsi_gt', symbol: 'SBIN'})).toBe(false);
  });

  it('includes Renko Smart in table-change push allowlist and excludes Hot Subsectors', () => {
    expect(ADVISOR_TABLE_KEYS.RENKO_SMART).toBe('renko_smart');
    expect(ADVISOR_TABLE_META[ADVISOR_TABLE_KEYS.RENKO_SMART]?.advisorTab).toBe('renko');
    expect(isPushEligibleTableKey('renko_smart', ADVISOR_TABLE_META)).toBe(true);
    expect(isPushEligibleTableKey('trend_b1_weekly', ADVISOR_TABLE_META)).toBe(true);
    expect(isPushExcludedTableKey('hot_subsectors')).toBe(true);
    expect(isPushEligibleTableKey('hot_subsectors', ADVISOR_TABLE_META)).toBe(false);
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
