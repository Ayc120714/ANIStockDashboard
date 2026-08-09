import {
  buildFiiDiiCard,
  buildPeriodAccessibilityLabel,
  filterRollingCalendarMonth,
  fmtCompactCr,
  fmtCr,
  mapQuarterCircles,
  mapYearCircles,
  MIN_FII_DII_DAYS,
  normalizeFiiSectorFlowsPayload,
  normalizeFiiSectorStocksPayload,
  nextFiiSectorStockSort,
  periodCircleShownPoint,
  periodCircleTone,
  periodFlowLabel,
  sortFiiSectorRows,
  sortFiiSectorStockRows,
} from '@core/utils/fiiDiiPayload';

describe('fiiDiiPayload', () => {
  const sampleDaily = [
    {date: '15-Jun-2026', fii: {net: 100}, dii: {net: -50}},
    {date: '10-Jun-2026', fii: {net: 200}, dii: {net: 80}},
    {date: '05-Jun-2026', fii: {net: -300}, dii: {net: 120}},
    {date: '28-May-2026', fii: {net: 400}, dii: {net: -90}},
    {date: '20-May-2026', fii: {net: 500}, dii: {net: 60}},
  ];

  const samplePayload = {
    effective_month: 7,
    mtd: {fii: {net: 0}, dii: {net: 150}},
    daily: sampleDaily,
    quarterly: [
      {year: 2026, quarter: 1, label: 'Q1', fii: {net: 1200}, dii: {net: -800}, has_data: true},
      {year: 2026, quarter: 2, label: 'Q2', fii: {net: -450}, dii: {net: 300}, has_data: true},
      {year: 2026, quarter: 3, label: 'Q3', fii: {net: null}, dii: {net: null}, has_data: false},
      {year: 2026, quarter: 4, label: 'Q4', fii: {net: null}, dii: {net: null}, has_data: false},
    ],
    yearly: [
      {year: 2026, label: '2026', fii: {net: 750}, dii: {net: -500}, has_data: true},
      {year: 2025, label: '2025', fii: {net: -12400}, dii: {net: 9000}, has_data: true},
      {year: 2024, label: '2024', fii: {net: null}, dii: {net: null}, has_data: false},
    ],
  };

  it('requests enough history rows for rolling-month filtering', () => {
    expect(MIN_FII_DII_DAYS).toBeGreaterThanOrEqual(30);
    expect(MIN_FII_DII_DAYS).toBe(45);
  });

  it('filters daily rows to the rolling month ending on the latest date', () => {
    const monthRows = filterRollingCalendarMonth(sampleDaily);
    expect(monthRows).toHaveLength(5);
    expect(monthRows.map(r => r.date)).toEqual([
      '15-Jun-2026',
      '10-Jun-2026',
      '05-Jun-2026',
      '28-May-2026',
      '20-May-2026',
    ]);
  });

  it('ignores rows older than the rolling month even when more history was fetched', () => {
    const extended = [
      ...sampleDaily,
      {date: '15-May-2026', fii: {net: 1}, dii: {net: -1}},
      {date: '01-May-2026', fii: {net: 2}, dii: {net: -2}},
    ];
    const monthRows = filterRollingCalendarMonth(extended);
    expect(monthRows.map(row => row.date)).toEqual([
      '15-Jun-2026',
      '10-Jun-2026',
      '05-Jun-2026',
      '28-May-2026',
      '20-May-2026',
    ]);
  });

  it('maps quarterly slots Q1-Q4 with missing periods as no-data', () => {
    const quarters = mapQuarterCircles(samplePayload.quarterly, 'fii');
    expect(quarters).toHaveLength(4);
    expect(quarters[0]).toMatchObject({label: 'Q1', net: 1200, hasData: true});
    expect(quarters[1]).toMatchObject({label: 'Q2', net: -450, hasData: true});
    expect(quarters[2]).toMatchObject({label: 'Q3', net: null, hasData: false});
    expect(quarters[3]).toMatchObject({label: 'Q4', net: null, hasData: false});
  });

  it('maps yearly circles for the latest three years', () => {
    const years = mapYearCircles(samplePayload.yearly, 'dii');
    expect(years).toHaveLength(3);
    expect(years[0]).toMatchObject({label: '2026', net: -500, hasData: true});
    expect(years[1]).toMatchObject({label: '2025', net: 9000, hasData: true});
    expect(years[2]).toMatchObject({label: '2024', net: null, hasData: false});
  });

  it('uses positive/negative/neutral tones without treating missing data as zero', () => {
    expect(periodCircleTone(1200, true)).toBe('positive');
    expect(periodCircleTone(-450, true)).toBe('negative');
    expect(periodCircleTone(null, false)).toBe('neutral');
    expect(periodFlowLabel(null, false)).toBe('No data');
    expect(periodFlowLabel(0, true)).toBe('Neutral');
    expect(periodFlowLabel(-450, true)).toBe('Sell');
    expect(periodFlowLabel(1200, true)).toBe('Buy');
  });

  it('formats compact crore amounts for circles and full amounts for accessibility', () => {
    expect(fmtCompactCr(12400)).toBe('+₹12.4K Cr');
    expect(fmtCompactCr(-12400)).toBe('-₹12.4K Cr');
    expect(fmtCompactCr(150.4)).toBe('+₹150 Cr');
    expect(fmtCompactCr(null)).toBe('—');
    expect(buildPeriodAccessibilityLabel('Q1', 12400, true, 2026)).toBe('Q1 2026 Buy ₹12,400.00 Cr');
    expect(buildPeriodAccessibilityLabel('Q4', null, false, 2026)).toBe('Q4 2026 No data');
    expect(buildPeriodAccessibilityLabel('2026', 0, true, 2026)).toBe('2026 Neutral ₹0.00 Cr');
  });

  it('builds card bars from rolling month while preserving latest and MTD', () => {
    const card = buildFiiDiiCard(samplePayload, 'fii');
    expect(card.bars).toEqual([500, 400, -300, 200, 100]);
    expect(card.latestNet).toBe(100);
    expect(card.mtdNet).toBe(0);
    expect(card.qtdNet).toBeNull();
    expect(card.ytdNet).toBe(750);
    expect(fmtCr(card.latestNet)).toBe('+₹100.00 Cr');
    expect(card.quarters).toHaveLength(4);
    expect(card.years).toHaveLength(3);
    expect(periodCircleShownPoint(card.quarters[0])).toEqual({net: 1200, date: 'Q1 2026'});
    expect(periodCircleShownPoint(card.years[0])).toEqual({net: 750, date: '2026'});
  });

  it('falls back to MTD bar when daily rows are unavailable', () => {
    const card = buildFiiDiiCard(
      {
        mtd: {fii: {net: 999}, dii: {net: -111}},
        daily: [],
        quarterly: [],
        yearly: [],
      },
      'fii',
    );
    expect(card.bars).toEqual([999]);
    expect(card.latestNet).toBe(999);
    expect(card.mtdNet).toBe(999);
  });

  it('normalizes Screener FII sector flows and sorts by fortnight change', () => {
    const normalized = normalizeFiiSectorFlowsPayload({
      as_of: '2026-07-31',
      sectors: [
        {sector: 'IT', fortnight_change: -10, flow_1y: 5},
        {sector: 'Banks', fortnight_change: 40, flow_1y: -2},
      ],
    });
    expect(sortFiiSectorRows(normalized.sectors).map(r => r.sector)).toEqual(['Banks', 'IT']);
    const stocks = normalizeFiiSectorStocksPayload({
      stocks: [{symbol: 'hdfcbank', day1d: 1.1, fii_pct: 22}],
    });
    expect(stocks.stocks[0].symbol).toBe('HDFCBANK');
  });

  it('sorts FII sector stocks up/down by each column', () => {
    const rows = [
      {symbol: 'SAPPHIRE', price: 2240, day1d: 12.26, fiiPct: 25.25, fiiPctDelta: 0.34},
      {symbol: 'EMIL', price: 165.83, day1d: 7.75, fiiPct: 13.96, fiiPctDelta: -3.73},
      {symbol: 'PGHL', price: 2464.1, day1d: 10.02, fiiPct: 6.82, fiiPctDelta: 0.63},
    ];
    expect(sortFiiSectorStockRows(rows, 'fiiPctDelta', 'asc').map(r => r.symbol)).toEqual([
      'EMIL',
      'SAPPHIRE',
      'PGHL',
    ]);
    expect(nextFiiSectorStockSort({key: 'price', direction: 'desc'}, 'price')).toEqual({
      key: 'price',
      direction: 'asc',
    });
  });
});
