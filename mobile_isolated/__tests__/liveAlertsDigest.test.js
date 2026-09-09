import {diffNewLiveAlerts, freshLiveAlertsToNotify, liveAlertsDigest} from '@core/utils/liveAlertsDigest';

describe('liveAlertsDigest', () => {
  const rows = [
    {id: 1, symbol: 'RELIANCE', alert_type: 'b1_breakout', created_at: '2026-06-15T10:00:00Z'},
    {id: 2, symbol: 'TCS', alert_type: 'entry_ready', created_at: '2026-06-15T10:05:00Z'},
  ];

  it('builds stable digest', () => {
    const d1 = liveAlertsDigest(rows);
    const d2 = liveAlertsDigest([...rows].reverse());
    expect(d1).toBe(d2);
    expect(d1.length).toBeGreaterThan(0);
  });

  it('diffs new live alerts', () => {
    const prev = liveAlertsDigest([rows[0]]);
    const fresh = diffNewLiveAlerts(prev, rows);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].symbol).toBe('TCS');
  });

  it('uses API timestamp when created_at is missing', () => {
    const row = {
      id: 91,
      symbol: 'ICIL',
      alert_type: 'weekly_cross_up_high',
      timestamp: '2026-09-04T13:18:00+05:30',
      ml_score: 0.7,
      source: 'ml_setup',
    };
    expect(liveAlertsDigest([row])).toContain('91:ICIL:weekly_cross_up_high');
  });

  it('notifies on first poll when a stored digest already exists and new HC alerts arrived', () => {
    const today = new Date().toISOString();
    const seen = {
      id: 1,
      symbol: 'RELIANCE',
      alert_type: 'renko_smart_long',
      timestamp: today,
      ml_score: 0.81,
      source: 'ml_setup',
    };
    const incoming = {
      id: 91,
      symbol: 'ICIL',
      alert_type: 'weekly_cross_up_high',
      timestamp: today,
      ml_score: 0.7,
      source: 'ml_setup',
    };
    const prev = liveAlertsDigest([seen]);
    const fresh = freshLiveAlertsToNotify(prev, [seen, incoming]);
    expect(fresh.map(row => row.symbol)).toEqual(['ICIL']);
  });

  it('does not vibrate on cold start with an empty digest', () => {
    const today = new Date().toISOString();
    const incoming = {
      id: 91,
      symbol: 'ICIL',
      alert_type: 'weekly_cross_up_high',
      timestamp: today,
      ml_score: 0.7,
      source: 'ml_setup',
    };
    expect(freshLiveAlertsToNotify('', [incoming])).toEqual([]);
    expect(freshLiveAlertsToNotify(null, [incoming])).toEqual([]);
  });
});
