import fs from 'fs';
import path from 'path';
import {
  coarseBinColor,
  defaultNewsKeywords,
  filterAndSortUniverseRows,
  filterExpirySymbolOptions,
  fineBinLabel,
  formatOcPct,
  isDateInSetupWeek,
  newsNameForSymbol,
  nextUniverseSort,
  outlierPointColor,
  setupWeekForDate,
  setupWeekSelectLabel,
  weeksWithSetupCounts,
} from './expiryAnalysisDisplay';

describe('expiryAnalysisDisplay', () => {
  it('maps coarse bins to a green-to-red gradient', () => {
    expect(coarseBinColor(5, null)).toBe('#16a34a');
    expect(coarseBinColor(0, 1)).toBe('#86efac');
    expect(coarseBinColor(null, -5)).toBe('#dc2626');
  });

  it('formats OC percent with an explicit sign', () => {
    expect(formatOcPct(1.5)).toBe('+1.50%');
    expect(formatOcPct(-2.25)).toBe('-2.25%');
    expect(formatOcPct(null)).toBe('—');
  });

  it('picks rally vs fall news keywords from the weekly OC return', () => {
    expect(defaultNewsKeywords(6.8)).toMatch(/rally/);
    expect(defaultNewsKeywords(-3.1)).toMatch(/fall/);
    expect(newsNameForSymbol('BANKNIFTY')).toBe('Bank Nifty');
    expect(defaultNewsKeywords(2, 'RELIANCE')).toMatch(/RELIANCE rally/);
  });

  it('caps stock picker results so the universe is not dumped into the list', () => {
    const opts = [
      { symbol: 'RELIANCE', display_name: 'RELIANCE', kind: 'stock' },
      { symbol: 'INFY', display_name: 'INFY', kind: 'stock' },
      { symbol: 'TCS', display_name: 'TCS', kind: 'stock' },
    ];
    expect(filterExpirySymbolOptions(opts, '')).toEqual([]);
    expect(filterExpirySymbolOptions(opts, 're').map((r) => r.symbol)).toEqual(['RELIANCE']);
    expect(filterExpirySymbolOptions(opts, 'i', { maxResults: 1 })).toHaveLength(1);
  });

  it('colors outlier scatter points by kind', () => {
    expect(outlierPointColor('upside')).toBe('#22c55e');
    expect(outlierPointColor('downside')).toBe('#ef4444');
    expect(outlierPointColor('within')).toBe('#6b7280');
  });

  it('filters universe rows by upside/downside/within and sorts ML setup counts', () => {
    const rows = [
      { symbol: 'AAA', outlier_kind: 'upside', ml_setup_count: 2, oc_return: 6 },
      { symbol: 'BBB', outlier_kind: 'downside', ml_setup_count: 5, oc_return: -4 },
      { symbol: 'CCC', outlier_kind: 'within', ml_setup_count: 1, oc_return: 0.2 },
      { symbol: 'DDD', outlier_kind: 'upside', ml_setup_count: 9, oc_return: 8 },
    ];
    expect(filterAndSortUniverseRows(rows, { outlier: 'upside', sortKey: 'ml_setup_count', sortDir: 'desc' }).map((r) => r.symbol)).toEqual(['DDD', 'AAA']);
    expect(filterAndSortUniverseRows(rows, { outlier: 'downside', sortKey: 'ml_setup_count', sortDir: 'asc' }).map((r) => r.symbol)).toEqual(['BBB']);
    expect(filterAndSortUniverseRows(rows, { outlier: 'within' }).map((r) => r.symbol)).toEqual(['CCC']);
    expect(filterAndSortUniverseRows(rows, { sortKey: 'ml_setup_count', sortDir: 'asc' }).map((r) => r.symbol)).toEqual(['CCC', 'AAA', 'BBB', 'DDD']);
    expect(filterAndSortUniverseRows(rows, { sortKey: 'outlier', sortDir: 'desc' }).map((r) => r.outlier_kind)).toEqual([
      'upside', 'upside', 'within', 'downside',
    ]);
  });

  it('toggles universe sort direction on the same column and defaults numeric columns to descending', () => {
    expect(nextUniverseSort('ml_setup_count', 'desc', 'ml_setup_count')).toEqual({
      sortKey: 'ml_setup_count',
      sortDir: 'asc',
    });
    expect(nextUniverseSort('symbol', 'asc', 'ml_setup_count')).toEqual({
      sortKey: 'ml_setup_count',
      sortDir: 'desc',
    });
  });

  it('lists weeks that have ML setup counts and maps them to green/red bins', () => {
    const weeks = [
      { week_start: '2026-01-05', week_end: '2026-01-09', oc_return: 0.15, ml_setup_count: 0 },
      { week_start: '2026-01-12', week_end: '2026-01-16', oc_return: 1.05, ml_setup_count: 3, ml_setups: [{ symbol: 'HAL' }] },
      { week_start: '2026-01-19', week_end: '2026-01-23', oc_return: -0.25, ml_setup_count: 2 },
    ];
    const withCounts = weeksWithSetupCounts(weeks);
    expect(withCounts.map((w) => w.week_start)).toEqual(['2026-01-19', '2026-01-12']);
    expect(withCounts[1].side).toBe('green');
    expect(withCounts[1].range_label).toBe('1.0% to 1.1%');
    expect(withCounts[0].side).toBe('red');
    expect(fineBinLabel(-0.25)).toBe('-0.3% to -0.2%');
    expect(setupWeekSelectLabel(withCounts[1])).toBe('2026-01-12 → 2026-01-16 · 3 setups · +1.05%');
    expect(isDateInSetupWeek(withCounts, '2026-01-14')).toBe(true);
    expect(isDateInSetupWeek(withCounts, '2026-01-06')).toBe(false);
    expect(setupWeekForDate(withCounts, '2026-01-23')?.ml_setup_count).toBe(2);
  });
});

describe('expiry analysis admin wiring', () => {
  it('keeps the dashboard on an admin-only web route and mobile More hub link', () => {
    const webRoot = path.resolve(__dirname, '..');
    const router = fs.readFileSync(path.join(webRoot, 'routes/AppRouter.js'), 'utf8');
    expect(router).toMatch(/path="\/expiry-analysis"/);
    expect(router).toMatch(/AdminRoute level="admin"/);
    expect(router).toMatch(/ExpiryAnalysisAdminPage/);
    const page = fs.readFileSync(path.join(webRoot, 'pages/ExpiryAnalysisAdminPage.js'), 'utf8');
    expect(page).toMatch(/filterAndSortUniverseRows/);
    expect(page).toMatch(/weeksWithSetupCounts/);
    expect(page).toMatch(/outlierFilter/);
    expect(page).toMatch(/TableSortLabel/);
    expect(page).toMatch(/isDateInSetupWeek/);
    expect(page).toMatch(/DatePicker/);

    const sidebar = fs.readFileSync(path.join(webRoot, 'components/Sidebar/Sidebar.js'), 'utf8');
    expect(sidebar).toMatch(/to="\/expiry-analysis"/);
    expect(sidebar).toMatch(/isAdmin \?/);

    const mobile = fs.readFileSync(
      path.join(webRoot, '../mobile_isolated/src/navigation/siteSections.js'),
      'utf8',
    );
    expect(mobile).toMatch(/path: '\/expiry-analysis'/);
    expect(mobile).toMatch(/SITE_SECTIONS_ADMIN/);
  });
});
