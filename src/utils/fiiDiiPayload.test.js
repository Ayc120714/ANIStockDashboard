import {
  buildFiiDiiCard,
  buildPeriodCircle,
  filterDailyForLatestCalendarMonth,
  formatAccessibleCr,
  formatCompactCr,
  getFiiDiiColor,
  getNetSignKind,
  mapQuarterCircles,
  mapYearCircles,
  periodCircleShownPoint,
  FII_DII_NEGATIVE_COLOR,
  FII_DII_NEUTRAL_COLOR,
  FII_DII_POSITIVE_COLOR,
} from './fiiDiiPayload';

describe('fiiDiiPayload', () => {
  it('filters daily rows to the rolling month ending on the latest available date', () => {
    const daily = [
      { date: '17-Jun-2026', fii: { net: 1 }, dii: { net: 2 } },
      { date: '18-Jun-2026', fii: { net: 3 }, dii: { net: 4 } },
      { date: '01-Jul-2026', fii: { net: 5 }, dii: { net: 6 } },
      { date: '18-Jul-2026', fii: { net: 7 }, dii: { net: 8 } },
    ];

    const filtered = filterDailyForLatestCalendarMonth(daily);
    expect(filtered.map((row) => row.date)).toEqual(['18-Jun-2026', '01-Jul-2026', '18-Jul-2026']);
    expect(filtered).toHaveLength(3);
  });

  it('maps quarter circles for the effective year and marks missing quarters as neutral', () => {
    const quarterly = [
      { year: 2026, quarter: 1, label: 'Q1 2026', has_data: true, fii: { net: 1200 }, dii: { net: -500 } },
      { year: 2026, quarter: 3, label: 'Q3 2026', has_data: true, fii: { net: -12400 }, dii: { net: 800 } },
      { year: 2026, quarter: 4, label: 'Q4 2026', has_data: false, fii: { net: 0 }, dii: { net: 0 } },
    ];

    const circles = mapQuarterCircles(quarterly, 2026, 'fii');
    expect(circles.map((c) => c.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    expect(circles[0]).toMatchObject({ display: '₹1.2K Cr', color: FII_DII_POSITIVE_COLOR, signKind: 'buy' });
    expect(circles[1]).toMatchObject({ display: '—', color: FII_DII_NEUTRAL_COLOR, hasData: false });
    expect(circles[2]).toMatchObject({ display: '-₹12.4K Cr', color: FII_DII_NEGATIVE_COLOR, signKind: 'sell' });
    expect(circles[3]).toMatchObject({ display: '—', hasData: false, color: FII_DII_NEUTRAL_COLOR });
    expect(circles[2].ariaLabel).toBe('Q3 2026 Sell ₹12,400 Cr');
  });

  it('maps the latest three year circles from the effective year anchor', () => {
    const yearly = [
      { year: 2026, label: '2026', has_data: true, fii: { net: 900 }, dii: { net: 100 } },
      { year: 2024, label: '2024', has_data: true, fii: { net: -2500 }, dii: { net: 0 } },
    ];

    const circles = mapYearCircles(yearly, 2026, 'fii');
    expect(circles.map((c) => c.label)).toEqual(['2026', '2025', '2024']);
    expect(circles[0].display).toBe('₹900 Cr');
    expect(circles[1]).toMatchObject({ display: '—', hasData: false });
    expect(circles[2]).toMatchObject({ display: '-₹2.5K Cr', signKind: 'sell' });
  });

  it('uses buy/sell/none sign colors and compact crore formatting', () => {
    expect(getNetSignKind(500, true)).toBe('buy');
    expect(getNetSignKind(-12, true)).toBe('sell');
    expect(getNetSignKind(0, false)).toBe('none');
    expect(getFiiDiiColor(500, true)).toBe(FII_DII_POSITIVE_COLOR);
    expect(getFiiDiiColor(-12, true)).toBe(FII_DII_NEGATIVE_COLOR);
    expect(getFiiDiiColor(0, false)).toBe(FII_DII_NEUTRAL_COLOR);
    expect(formatCompactCr(-12400)).toBe('-₹12.4K Cr');
    expect(formatAccessibleCr(-12400)).toBe('-₹12,400 Cr');
    expect(buildPeriodCircle({
      net: -12400,
      hasData: true,
      periodLabel: 'Q1',
      year: 2026,
    }).ariaLabel).toBe('Q1 2026 Sell ₹12,400 Cr');
    expect(buildPeriodCircle({
      net: 0,
      hasData: true,
      periodLabel: '2026',
      year: 2026,
    }).ariaLabel).toBe('2026 Neutral ₹0 Cr');
  });

  it('builds card series from one rolling month while preserving MTD and period circles', () => {
    const payload = {
      effective_month: 7,
      effective_year: 2026,
      mtd: { fii: { net: 1500 }, dii: { net: -200 } },
      daily: [
        { date: '17-Jun-2026', fii: { net: 10 }, dii: { net: 20 } },
        { date: '18-Jun-2026', fii: { net: 20 }, dii: { net: 30 } },
        { date: '01-Jul-2026', fii: { net: 100 }, dii: { net: 200 } },
        { date: '18-Jul-2026', fii: { net: 300 }, dii: { net: 400 } },
      ],
      quarterly: [
        { year: 2026, quarter: 1, has_data: true, fii: { net: 1200 }, dii: { net: -500 } },
        { year: 2026, quarter: 3, has_data: true, fii: { net: -4500 }, dii: { net: 21000 } },
      ],
      yearly: [
        { year: 2026, has_data: true, fii: { net: 900 }, dii: { net: 100 } },
      ],
    };

    const card = buildFiiDiiCard(payload, 'fii');
    expect(card.series.map((point) => point.date)).toEqual(['18-Jun-2026', '01-Jul-2026', '18-Jul-2026']);
    expect(card.bars).toEqual([20, 100, 300]);
    expect(card.latestDate).toBe('18-Jul-2026');
    expect(card.mtdNet).toBe(1500);
    expect(card.qtdNet).toBe(-4500);
    expect(card.ytdNet).toBe(900);
    expect(card.quarters).toHaveLength(4);
    expect(card.years).toHaveLength(3);
    expect(periodCircleShownPoint(card.quarters[2])).toEqual({ net: -4500, date: 'Q3 2026' });
    expect(periodCircleShownPoint(card.years[0])).toEqual({ net: 900, date: '2026' });
    expect(periodCircleShownPoint(card.quarters[3])).toBeNull();
  });
});
