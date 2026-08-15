import { resolveFetchCacheMode } from './liveFetchPolicy';

describe('liveFetchPolicy', () => {
  it('uses no-store during live so Redis-backed APIs are not shadowed by HTTP cache', () => {
    expect(resolveFetchCacheMode({ getCacheTtlMs: 0 })).toBe('no-store');
    expect(resolveFetchCacheMode({ skipCache: true, getCacheTtlMs: 8_000 })).toBe('no-store');
  });

  it('leaves browser cache unset when a closed-market GET memo is allowed', () => {
    expect(resolveFetchCacheMode({ skipCache: false, getCacheTtlMs: 24 * 60 * 60_000 })).toBeUndefined();
  });

  it('honors an explicit fetch cache mode', () => {
    expect(resolveFetchCacheMode({ skipCache: true, explicit: 'reload' })).toBe('reload');
  });
});
