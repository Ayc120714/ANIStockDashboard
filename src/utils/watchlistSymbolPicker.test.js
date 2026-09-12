import fs from 'fs';
import path from 'path';
import {
  filterWatchlistAddOptions,
  WATCHLIST_ADD_MAX_RESULTS,
} from './watchlistSymbolPicker';

describe('filterWatchlistAddOptions', () => {
  const opts = [
    {symbol: 'RELIANCE', sector: 'Energy', subsector: 'Oil'},
    {symbol: 'TCS', sector: 'IT', subsector: 'Software'},
    {symbol: 'INFY', sector: 'IT', subsector: 'Software'},
    {symbol: 'LUMINO', sector: 'IPO', subsector: 'Lumino Industries', is_ipo: true},
    {symbol: 'BHARATCOAL', sector: 'Energy', subsector: 'Coal', is_ipo: true},
  ];

  it('does not dump the full master list when the ST/LT search box is empty', () => {
    expect(filterWatchlistAddOptions(opts, '').map((o) => o.symbol)).toEqual(['LUMINO', 'BHARATCOAL']);
    expect(filterWatchlistAddOptions(opts, '   ').map((o) => o.symbol)).toEqual(['LUMINO', 'BHARATCOAL']);
  });

  it('matches IPO tickers and company names after they are unioned into available-symbols', () => {
    expect(filterWatchlistAddOptions(opts, 'lumino').map((o) => o.symbol)).toEqual(['LUMINO']);
    expect(filterWatchlistAddOptions(opts, 'bharatcoal').map((o) => o.symbol)).toEqual(['BHARATCOAL']);
    expect(filterWatchlistAddOptions(opts, 'ipo').map((o) => o.symbol)).toEqual(['LUMINO']);
  });

  it('matches symbol, sector, and subsector and caps results', () => {
    expect(filterWatchlistAddOptions(opts, 'tcs').map(o => o.symbol)).toEqual(['TCS']);
    expect(filterWatchlistAddOptions(opts, 'software').map(o => o.symbol)).toEqual(['TCS', 'INFY']);
    const many = Array.from({length: 80}, (_, i) => ({symbol: `SYM${i}`, sector: 'IT', subsector: ''}));
    expect(filterWatchlistAddOptions(many, 'sym')).toHaveLength(WATCHLIST_ADD_MAX_RESULTS);
  });

  it('is wired into Short Term and Long Term add-stock Autocomplete', () => {
    const st = fs.readFileSync(path.join(__dirname, '../pages/ShortTermPage.js'), 'utf8');
    const lt = fs.readFileSync(path.join(__dirname, '../pages/LongTermPage.js'), 'utf8');
    expect(st).toMatch(/filterWatchlistAddOptions\(opts, inputValue\)/);
    expect(lt).toMatch(/filterWatchlistAddOptions\(opts, inputValue\)/);
    expect(st).toMatch(/openOnFocus/);
    expect(lt).toMatch(/openOnFocus/);
  });
});
