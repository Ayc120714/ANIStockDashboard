import { applyWatchlistRowMutation, normalizeWatchlistSymbol } from './watchlistLocalMutation';

describe('watchlistLocalMutation', () => {
  const base = [{ symbol: 'RELIANCE' }, { symbol: 'TCS' }];

  it('normalizes symbols to uppercase', () => {
    expect(normalizeWatchlistSymbol(' infy ')).toBe('INFY');
  });

  it('appends added symbols immediately (regression: LT/ST add required hard refresh)', () => {
    const next = applyWatchlistRowMutation(base, { added: ['hdfcbank'] });
    expect(next.map((r) => r.symbol)).toEqual(['RELIANCE', 'TCS', 'HDFCBANK']);
  });

  it('does not duplicate symbols on add', () => {
    const next = applyWatchlistRowMutation(base, { added: ['TCS', 'INFY'] });
    expect(next.map((r) => r.symbol)).toEqual(['RELIANCE', 'TCS', 'INFY']);
  });

  it('removes deleted symbols optimistically', () => {
    const next = applyWatchlistRowMutation(base, { removed: ['tcs'] });
    expect(next.map((r) => r.symbol)).toEqual(['RELIANCE']);
  });

  it('applies add and remove in one mutation', () => {
    const next = applyWatchlistRowMutation(base, { added: ['INFY'], removed: ['RELIANCE'] });
    expect(next.map((r) => r.symbol)).toEqual(['TCS', 'INFY']);
  });
});
