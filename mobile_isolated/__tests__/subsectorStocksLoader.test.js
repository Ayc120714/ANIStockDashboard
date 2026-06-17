import {
  hasSubsectorStocksPayload,
  loadSubsectorStocksPage,
  normSubsectorStockMatchKey,
  subsectorStockQueryVariants,
} from '@core/utils/subsectorStocksLoader';

describe('subsectorStocksLoader', () => {
  describe('subsectorStockQueryVariants', () => {
    it('includes ampersand and "and" variants for dealership subsectors', () => {
      const variants = subsectorStockQueryVariants('Auto and truck dealerships');
      expect(variants).toContain('Auto and truck dealerships');
      expect(variants.some(v => v.includes('&'))).toBe(true);
    });

    it('returns empty array for blank input', () => {
      expect(subsectorStockQueryVariants('')).toEqual([]);
      expect(subsectorStockQueryVariants(null)).toEqual([]);
    });
  });

  describe('normSubsectorStockMatchKey', () => {
    it('treats ampersand and "and" as equivalent', () => {
      expect(normSubsectorStockMatchKey('Auto & Truck Dealerships')).toBe(
        normSubsectorStockMatchKey('Auto and truck dealerships'),
      );
    });
  });

  describe('hasSubsectorStocksPayload', () => {
    it('rejects empty row arrays so failed lookups are not cached as usable', () => {
      expect(hasSubsectorStocksPayload({rows: [], total: 0, page: 1})).toBe(false);
    });

    it('accepts payloads with at least one stock row', () => {
      expect(
        hasSubsectorStocksPayload({
          rows: [{symbol: 'CARTRADE'}],
          total: 1,
          page: 1,
        }),
      ).toBe(true);
    });
  });

  describe('loadSubsectorStocksPage', () => {
    it('tries query variants until primary API returns rows', async () => {
      const fetchStocksForSubsector = jest.fn(async query => {
        if (String(query).toLowerCase().includes('&')) {
          return {data: [{symbol: 'CARTRADE'}], total: 1, page: 1, pageSize: 5};
        }
        return {data: [], total: 0, page: 1, pageSize: 5};
      });
      const fetchStocksBySubsector = jest.fn(async () => []);

      const result = await loadSubsectorStocksPage(
        {fetchStocksForSubsector, fetchStocksBySubsector},
        'Auto and truck dealerships',
        1,
        5,
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].symbol).toBe('CARTRADE');
      expect(fetchStocksForSubsector.mock.calls.length).toBeGreaterThan(1);
      expect(fetchStocksBySubsector).not.toHaveBeenCalled();
    });

    it('falls back to by-subsector when primary API returns empty for all variants', async () => {
      const fetchStocksForSubsector = jest.fn(async () => ({data: [], total: 0, page: 1, pageSize: 5}));
      const fetchStocksBySubsector = jest.fn(async query => {
        if (String(query).toLowerCase().includes('&')) {
          return [{symbol: 'CARTRADE', subsector: 'Auto & Truck Dealerships'}];
        }
        return [];
      });

      const result = await loadSubsectorStocksPage(
        {fetchStocksForSubsector, fetchStocksBySubsector},
        'Auto and truck dealerships',
        1,
        5,
      );

      expect(result.rows).toHaveLength(1);
      expect(fetchStocksBySubsector).toHaveBeenCalled();
    });
  });
});
