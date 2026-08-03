/**
 * Guard: mobile Renko Smart tab loads the 44-50 fib-zone pullback flow.
 */
describe('advisor Renko fib-zone mobile data source', () => {
  it('uses renko-fib-zone endpoint for the Renko Smart tab', () => {
    const endpoint = '/advisor/signals/renko-fib-zone';
    expect(endpoint).toContain('renko-fib-zone');
    expect(endpoint).not.toContain('renko-smart');
  });

  it('keeps display columns limited to Symbol CMP T1 T2 SL', () => {
    const cols = ['symbol', 'close', 'target_1', 'target_2', 'stop_loss'];
    expect(cols).toEqual(['symbol', 'close', 'target_1', 'target_2', 'stop_loss']);
    expect(cols).not.toContain('entry');
    expect(cols).not.toContain('relative_volume');
  });
});
