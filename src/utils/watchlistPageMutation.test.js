import { readPageCache } from './pageDataCache';
import {
  bumpWatchlistLoadGeneration,
  collectWatchlistMutationSymbols,
  computeOptimisticWatchlistMutation,
} from './watchlistPageMutation';

describe('watchlistPageMutation', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('collectWatchlistMutationSymbols normalizes add/remove lists', () => {
    const { removed, added, hasChange } = collectWatchlistMutationSymbols({
      added: ['infy'],
      removed: ['tcs'],
    });
    expect(added).toEqual(['INFY']);
    expect([...removed]).toEqual(['TCS']);
    expect(hasChange).toBe(true);
  });

  it('persists optimistic rows so poll hydrate sees deleted symbols removed', () => {
    const cacheKey = 'shortTermWatchlist_test';
    const rows = [{ symbol: '360ONE' }, { symbol: 'HAL' }];
    computeOptimisticWatchlistMutation(rows, { removed: ['360ONE', 'HAL'] }, cacheKey, []);
    const cached = readPageCache(cacheKey);
    expect(cached.data.watchlist).toEqual([]);
  });

  it('bumpWatchlistLoadGeneration invalidates in-flight load generation', () => {
    const loadGenRef = { current: 3 };
    bumpWatchlistLoadGeneration(loadGenRef);
    expect(loadGenRef.current).toBe(4);
  });
});
