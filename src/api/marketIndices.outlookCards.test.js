import { deriveOutlookCardsFromTable } from './marketIndices';

describe('deriveOutlookCardsFromTable', () => {
  const tableRows = [
    {
      name: 'Nifty 50',
      trend: 'UP TREND',
      trendDirection: 'up',
      value: '24,052.85',
      percentile: '96.00%',
      day1d: '-0.01%',
      pe: '23.0 PE',
    },
    {
      name: 'Nifty Next 50',
      trend: 'UP TREND',
      trendDirection: 'up',
      value: '72,199.55',
      percentile: '79.00%',
      day1d: '+0.00%',
      pe: '20.0 PE',
    },
    {
      name: 'Nifty Midcap 100',
      trend: 'UP TREND',
      trendDirection: 'up',
      value: '60,692.00',
      percentile: '98.00%',
      day1d: '-0.35%',
      pe: '34.0 PE',
    },
    {
      name: 'Nifty Smlcap 100',
      trend: 'UP TREND',
      trendDirection: 'up',
      value: '18,184.00',
      percentile: '71.00%',
      day1d: '-0.37%',
      pe: '31.0 PE',
    },
  ];

  it('builds overview cards from the same CMP values as the indices table', () => {
    const { indexCards, smallcapCards } = deriveOutlookCardsFromTable(tableRows);
    expect(indexCards[0]).toEqual(
      expect.objectContaining({
        title: 'Nifty 50',
        value: '24,052.85',
        change: '-0.01%',
      }),
    );
    expect(indexCards[1].value).toBe('72,199.55');
    expect(smallcapCards[0].value).toBe('18,184.00');
  });
});
