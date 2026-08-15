import fs from 'fs';
import path from 'path';

describe('MlSetupsTable', () => {
  it('does not pass the TradingView style helper function as a DOM style (React 19 blank screen)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, './MlSetupsTable.js'), 'utf8');
    expect(src).not.toMatch(/style=\{symbolCellTdStyle\}/);
    expect(src).toMatch(/symbolCellTdStyle\(compact\)/);
  });

  it('offers Copy CSV of unique symbols like other Advisor tables', () => {
    const src = fs.readFileSync(path.resolve(__dirname, './MlSetupsTable.js'), 'utf8');
    expect(src).toMatch(/Copy CSV/);
    expect(src).toMatch(/buildTradingViewSymbolsCsv/);
    expect(src).toMatch(/navigator\.clipboard\.writeText/);
  });

  it('pages 10 rows and starts sorted by RVOL descending', () => {
    const src = fs.readFileSync(path.resolve(__dirname, './MlSetupsTable.js'), 'utf8');
    expect(src).toMatch(/ML_SETUPS_PAGE_SIZE/);
    expect(src).toMatch(/ML_SETUPS_DEFAULT_SORT_COL/);
    expect(src).toMatch(/sortMlSetupRows/);
    expect(src).not.toMatch(/const PAGE_SIZE = 25/);
    expect(src).not.toMatch(/useState\('ml_score'\)/);
  });
});
