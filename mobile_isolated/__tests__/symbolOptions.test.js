import {
  filterSymbolOptions,
  mergeSymbolOptions,
  normalizeSymbolOption,
} from '@core/utils/symbolOptions';

describe('symbolOptions IPO picker', () => {
  const options = mergeSymbolOptions([
    {symbol: 'RELIANCE', sector: 'Energy'},
    {symbol: 'TCS', sector: 'IT'},
    {symbol: 'LUMINO', sector: 'IPO', subsector: 'Lumino Industries', is_ipo: true},
    {symbol: 'BHARATCOAL', sector: 'Energy', is_ipo: true},
  ]);

  it('lists current IPO stocks when the ST/LT add box is empty instead of A-Z slice', () => {
    expect(filterSymbolOptions(options, '', 24).map(o => o.symbol)).toEqual(['BHARATCOAL', 'LUMINO']);
  });

  it('finds IPO tickers by symbol or company name', () => {
    expect(filterSymbolOptions(options, 'lumino').map(o => o.symbol)).toEqual(['LUMINO']);
    expect(filterSymbolOptions(options, 'BHARAT').map(o => o.symbol)).toEqual(['BHARATCOAL']);
  });

  it('keeps is_ipo on merged API rows', () => {
    const lumino = options.find(o => o.symbol === 'LUMINO');
    expect(normalizeSymbolOption(lumino).is_ipo).toBe(true);
    expect(options.find(o => o.symbol === 'RELIANCE').is_ipo).toBe(false);
  });
});
