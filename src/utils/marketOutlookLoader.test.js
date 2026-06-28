import {
  fiiDiiCacheIsStale,
  fiiDiiHasUsable,
  marketOutlookHasUsable,
  normalizeMarketOutlookPayload,
} from './marketOutlookLoader';

describe('marketOutlookLoader', () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('detects usable cached market outlook payloads', () => {
    expect(marketOutlookHasUsable({ indexCards: [{ title: 'Nifty 50' }] })).toBe(true);
    expect(marketOutlookHasUsable({ tableData: [] })).toBe(false);
  });

  it('derives index cards from table when legacy prefetch cache only stored nested indices', () => {
    const legacyPrefetch = {
      indices: {
        indexCards: [
          { title: 'Nifty 50', value: '25,879', change: '+0.01%' },
        ],
      },
      tableData: [
        {
          name: 'Nifty 50',
          value: '24,052.85',
          day1d: '-0.01%',
          trend: 'UP TREND',
          trendDirection: 'up',
          percentile: '96.00%',
        },
      ],
    };

    const normalized = normalizeMarketOutlookPayload(legacyPrefetch);
    expect(normalized.indexCards[0].value).toBe('24,052.85');
    expect(normalized.indexCards[0].change).toBe('-0.01%');
    expect(marketOutlookHasUsable(legacyPrefetch)).toBe(true);
  });

  it('marks FII/DII cache stale when server day is ahead of latest available iso', () => {
    const stale = fiiDiiCacheIsStale({
      updatedAt: Date.now(),
      data: {
        latest_available_iso: '2026-06-24',
        server_date_iso: '2026-06-25',
        daily: [{ date: '24-Jun-2026' }],
      },
    });
    expect(stale).toBe(true);
    expect(fiiDiiHasUsable({ daily: [{ date: '24-Jun-2026' }] })).toBe(true);
  });
});
