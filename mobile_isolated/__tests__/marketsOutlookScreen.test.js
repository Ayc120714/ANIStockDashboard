import {
  marketsOutlookListForTab,
  marketsOutlookPayloadUsable,
  refreshMarketsOutlookOnFocus,
  shouldMarketsFocusReloadSilent,
} from '@core/utils/marketsOutlookScreen';

describe('marketsOutlookScreen helpers', () => {
  describe('marketsOutlookListForTab', () => {
    const payload = {
      rows: [{name: 'NIFTY'}],
      sectorRows: [{name: 'BANK'}],
      subRows: [{name: 'IT'}],
    };

    it('returns market rows on market tab', () => {
      expect(marketsOutlookListForTab('market', payload)).toEqual(payload.rows);
    });

    it('returns sector rows on sector tab', () => {
      expect(marketsOutlookListForTab('sector', payload)).toEqual(payload.sectorRows);
    });

    it('returns subsector rows on subsector tab', () => {
      expect(marketsOutlookListForTab('subsector', payload)).toEqual(payload.subRows);
    });

    it('defaults to empty arrays when fields are missing', () => {
      expect(marketsOutlookListForTab('market')).toEqual([]);
      expect(marketsOutlookListForTab('sector')).toEqual([]);
      expect(marketsOutlookListForTab('subsector')).toEqual([]);
    });
  });

  describe('shouldMarketsFocusReloadSilent', () => {
    it('is false when there is no cached list and no FII/DII', () => {
      expect(shouldMarketsFocusReloadSilent({listLength: 0, fii: null})).toBe(false);
    });

    it('is true when market rows are already on screen', () => {
      expect(shouldMarketsFocusReloadSilent({listLength: 3, fii: null})).toBe(true);
    });

    it('is true when only FII/DII is cached (no index rows)', () => {
      expect(shouldMarketsFocusReloadSilent({listLength: 0, fii: {fii_net: 100}})).toBe(true);
    });

    it('is true when both rows and FII/DII are present', () => {
      expect(shouldMarketsFocusReloadSilent({listLength: 1, fii: {dii_net: 50}})).toBe(true);
    });
  });

  describe('marketsOutlookPayloadUsable', () => {
    it('market tab: usable with index rows', () => {
      expect(marketsOutlookPayloadUsable('market', {rows: [{name: 'NIFTY'}], fii: null})).toBe(true);
    });

    it('market tab: usable with FII/DII only', () => {
      expect(marketsOutlookPayloadUsable('market', {rows: [], fii: {summary: 'ok'}})).toBe(true);
    });

    it('market tab: not usable when empty', () => {
      expect(marketsOutlookPayloadUsable('market', {rows: [], fii: null})).toBe(false);
      expect(marketsOutlookPayloadUsable('market', null)).toBe(false);
    });

    it('sector tab: usable with sector rows', () => {
      expect(marketsOutlookPayloadUsable('sector', {sectorRows: [{name: 'BANK'}]})).toBe(true);
    });

    it('sector tab: not usable when empty', () => {
      expect(marketsOutlookPayloadUsable('sector', {sectorRows: []})).toBe(false);
    });

    it('subsector tab: usable with subsector rows', () => {
      expect(marketsOutlookPayloadUsable('subsector', {subRows: [{name: 'IT'}]})).toBe(true);
    });

    it('subsector tab: not usable when empty', () => {
      expect(marketsOutlookPayloadUsable('subsector', {subRows: []})).toBe(false);
    });
  });

  describe('refreshMarketsOutlookOnFocus', () => {
    const cacheKey = '@ani/mobile/page-cache/markets-outlook-v2-market';

    it('does not reload when cache is fresh', async () => {
      const load = jest.fn();
      const result = await refreshMarketsOutlookOnFocus({
        cacheKey,
        listLength: 5,
        fii: {x: 1},
        shouldRefreshPageCache: jest.fn(async () => false),
        load,
      });
      expect(result).toEqual({refreshed: false, silent: false});
      expect(load).not.toHaveBeenCalled();
    });

    it('reloads loudly when stale and screen is empty', async () => {
      const load = jest.fn(async () => {});
      const result = await refreshMarketsOutlookOnFocus({
        cacheKey,
        listLength: 0,
        fii: null,
        shouldRefreshPageCache: jest.fn(async () => true),
        load,
      });
      expect(result).toEqual({refreshed: true, silent: false});
      expect(load).toHaveBeenCalledWith({silent: false});
    });

    it('reloads silently when stale and market rows are visible', async () => {
      const load = jest.fn(async () => {});
      const result = await refreshMarketsOutlookOnFocus({
        cacheKey,
        listLength: 2,
        fii: null,
        shouldRefreshPageCache: jest.fn(async () => true),
        load,
      });
      expect(result).toEqual({refreshed: true, silent: true});
      expect(load).toHaveBeenCalledWith({silent: true});
    });

    it('reloads silently when stale and only FII/DII is cached', async () => {
      const load = jest.fn(async () => {});
      const result = await refreshMarketsOutlookOnFocus({
        cacheKey,
        listLength: 0,
        fii: {fii_net: 1},
        shouldRefreshPageCache: jest.fn(async () => true),
        load,
      });
      expect(result).toEqual({refreshed: true, silent: true});
      expect(load).toHaveBeenCalledWith({silent: true});
    });

    it('uses the correct cache key per tab when checking staleness', async () => {
      const shouldRefreshPageCache = jest.fn(async () => false);
      const load = jest.fn();
      await refreshMarketsOutlookOnFocus({
        cacheKey: '@ani/mobile/page-cache/markets-outlook-v2-sector',
        listLength: 1,
        fii: null,
        shouldRefreshPageCache,
        load,
      });
      expect(shouldRefreshPageCache).toHaveBeenCalledWith(
        '@ani/mobile/page-cache/markets-outlook-v2-sector',
      );
    });
  });
});
