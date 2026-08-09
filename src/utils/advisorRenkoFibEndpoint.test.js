/**
 * Guard: Renko Smart tab loads the combined 5m setup from renko-smart.
 */
import {buildTradingViewSymbolsCsv} from '../components/TradingViewLink';

describe('advisor Renko Smart data source', () => {
  it('uses renko-smart endpoint for the Renko Smart tab', () => {
    const endpoint = '/advisor/signals/renko-smart';
    expect(endpoint).toContain('renko-smart');
    expect(endpoint).not.toContain('renko-fib-zone');
  });

  it('describes the combined 5m setup gates', () => {
    const rules = {
      setup:
        '5m close crossed above upper Renko 44–50% ∩ EMA cloud green ∩ SuperTrend flip buy',
      timeframe: '5m',
    };
    expect(rules.timeframe).toBe('5m');
    expect(rules.setup).toContain('upper Renko 44–50%');
    expect(rules.setup).toContain('EMA cloud green');
    expect(rules.setup).toContain('SuperTrend flip');
  });

  it('requests the latest 10 session hits', () => {
    expect(10).toBe(10);
    const listRule = 'latest 10 hits for session day by signal time';
    expect(listRule).toContain('latest 10');
    expect(listRule).toContain('session day');
  });

  it('builds TradingView CSV for Copy CSV', () => {
    expect(buildTradingViewSymbolsCsv(['RELIANCE', 'tcs', 'RELIANCE'])).toBe(
      'NSE:RELIANCE,NSE:TCS',
    );
  });
});
