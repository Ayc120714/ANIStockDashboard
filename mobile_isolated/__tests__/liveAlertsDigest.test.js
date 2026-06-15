import {diffNewLiveAlerts, liveAlertsDigest} from '@core/utils/liveAlertsDigest';

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
});
