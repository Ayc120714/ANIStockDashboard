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
});
