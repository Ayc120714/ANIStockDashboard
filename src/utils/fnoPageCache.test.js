import {
  fnoCacheHasChain,
  fnoMoversCacheMatches,
  readFnoPageCache,
  writeFnoPageCache,
  writeFnoChainCache,
  readFnoChainCache,
  FNO_PAGE_CACHE_KEY,
} from './fnoPageCache';
import { readPageCache } from './pageDataCache';

describe('fnoPageCache', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('persists and restores page snapshot', () => {
    writeFnoPageCache({
      tab: 1,
      symbol: 'NIFTY',
      expiry: '2025-06-26',
      chainData: { chain: [{ strikePrice: 24000 }], spotPrice: 24100 },
      movers: [{ contract: 'NIFTY 24000 CE' }],
      moversFilter: 'volume',
    });
    const hit = readFnoPageCache();
    expect(hit?.symbol).toBe('NIFTY');
    expect(fnoCacheHasChain(hit)).toBe(true);
    expect(hit?.movers).toHaveLength(1);
    expect(readPageCache(FNO_PAGE_CACHE_KEY)?.updatedAt).toBeGreaterThan(0);
  });

  it('stores per symbol/expiry chain cache', () => {
    writeFnoChainCache('NIFTY', '2025-06-26', {
      chain: [{ strikePrice: 24100 }],
      spotPrice: 24168,
    });
    const hit = readFnoChainCache('NIFTY', '2025-06-26');
    expect(hit?.chain).toHaveLength(1);
    expect(hit?.spotPrice).toBe(24168);
  });

  it('matches movers cache by filter', () => {
    const cached = {
      symbol: 'NIFTY',
      expiry: '2025-06-26',
      moversFilter: 'volume',
      movers: [{ contract: 'x' }],
    };
    expect(fnoMoversCacheMatches(cached, {
      symbol: 'NIFTY',
      expiry: '2025-06-26',
      moversFilter: 'volume',
    })).toBe(true);
    expect(fnoMoversCacheMatches(cached, {
      symbol: 'NIFTY',
      expiry: '2025-06-26',
      moversFilter: 'oi_gainers',
    })).toBe(false);
  });
});
