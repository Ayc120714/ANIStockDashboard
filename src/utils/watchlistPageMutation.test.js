import { readPageCache } from './pageDataCache';
import {
  bumpWatchlistLoadGeneration,
  collectWatchlistMutationSymbols,
  computeOptimisticWatchlistMutation,
  mergeWatchlistMembershipFromCache,
  resolveWatchlistRowsAfterFetch,
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

  it('mergeWatchlistMembershipFromCache keeps optimistic deletes when API is stale (LT/ST)', () => {
    const apiRows = [{ symbol: '360ONE' }, { symbol: 'HAL' }];
    const cacheRows = [{ symbol: 'HAL' }];
    const merged = mergeWatchlistMembershipFromCache(apiRows, cacheRows);
    expect(merged.map((r) => r.symbol)).toEqual(['HAL']);
  });

  it('resolveWatchlistRowsAfterFetch reconciles membership on forceRefresh', () => {
    const cacheKey = 'longTermWatchlist_test';
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        data: { watchlist: [{ symbol: 'INFY' }], signals: [] },
        updatedAt: Date.now(),
      }),
    );
    const resolved = resolveWatchlistRowsAfterFetch(
      [{ symbol: 'TCS' }, { symbol: 'INFY' }],
      cacheKey,
      { forceRefresh: true },
    );
    expect(resolved.map((r) => r.symbol)).toEqual(['INFY']);
  });
});
