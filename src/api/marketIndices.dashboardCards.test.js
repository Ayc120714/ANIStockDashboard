import { apiGet } from './apiClient';
import { fetchMarketIndices, fetchMarketIndicesTable } from './marketIndices';

jest.mock('./apiClient', () => ({ apiGet: jest.fn() }));

describe('fetchMarketIndices (dashboard overview cards)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds dashboard cards from the same CMP + 1D values as the indices table', async () => {
    apiGet.mockResolvedValue([
      { name: 'Nifty 50', value: 24052.85, perf_1d: -0.01, pe: 23 },
      { name: 'Nifty Next 50', value: 72199.55, perf_1d: 0.0, pe: 20 },
      { name: 'Nifty Midcap 100', value: 60692, perf_1d: -0.35 },
      { name: 'Nifty Smlcap 100', value: 18184, perf_1d: -0.37 },
      { name: 'India VIX', value: 13.6, perf_1d: -0.96 },
    ]);

    const { indexCards, smallcapCards } = await fetchMarketIndices();

    expect(indexCards[0]).toEqual(
      expect.objectContaining({ title: 'Nifty 50', value: '24,052.85', change: '-0.01%' }),
    );
    expect(indexCards[1].value).toBe('72,199.55');
    expect(indexCards[2]).toEqual(
      expect.objectContaining({ title: 'Nifty Midcap 100', value: '60,692' }),
    );
    expect(smallcapCards[0]).toEqual(
      expect.objectContaining({ title: 'Nifty Smlcap 100', value: '18,184', change: '-0.37%' }),
    );
  });

  it('regression: 1D change on cards uses perf_1d only (indices-table parity), not the percentage_change fallback', async () => {
    // Bug: the dashboard MarketPulse cards used an independent row→card mapping that
    // fell back to percentage_change/change when perf_1d was absent, so the cards
    // showed a different 1D value (and could show stale CMP) than the indices table,
    // which renders perf_1d only. Cards must mirror the indices table exactly.
    apiGet.mockResolvedValue([
      { name: 'Nifty 50', value: 24052.85, percentage_change: 3.33, change: 3.33 },
    ]);

    const { indexCards } = await fetchMarketIndices();

    expect(indexCards[0].value).toBe('24,052.85');
    // Indices table shows "—" when perf_1d is missing; the card must match, not "+3.33%".
    expect(indexCards[0].change).toBe('—');
  });

  it('regression: every dashboard card CMP + 1D matches the corresponding indices-table row', async () => {
    const payload = [
      { name: 'Nifty 50', value: 24052.85, perf_1d: -0.01, pe: 23 },
      { name: 'Nifty Next 50', value: 72199.55, perf_1d: 0.12, pe: 20 },
      { name: 'Nifty Midcap 100', value: 60692, perf_1d: -0.35 },
      { name: 'Nifty Smlcap 100', value: 18184, perf_1d: -0.37 },
      { name: 'India VIX', value: 13.6, perf_1d: -0.96 },
    ];
    apiGet.mockResolvedValue(payload);

    const { indexCards, smallcapCards } = await fetchMarketIndices();
    apiGet.mockResolvedValue(payload);
    const tableRows = await fetchMarketIndicesTable();
    const tableByName = new Map(tableRows.map((r) => [r.name, r]));

    [...indexCards, ...smallcapCards].forEach((card) => {
      const row = tableByName.get(card.title);
      expect(row).toBeTruthy();
      expect(card.value).toBe(row.value);
      expect(card.change).toBe(row.day1d);
    });
  });
});
