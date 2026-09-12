import fs from 'fs';
import path from 'path';
import {
  initialWatchlistPanelState,
  shouldRenderWatchlistChromeOutsideList,
  watchlistHorizonLabel,
} from '@features/stocks/watchlistEmbeddedLayout';

const watchlistSectionSrc = fs.readFileSync(
  path.join(__dirname, '../src/features/stocks/WatchlistSection.js'),
  'utf8',
);

describe('watchlistEmbeddedLayout', () => {
  it('collapses add/trade panels by default when embedded in Stocks overview', () => {
    expect(initialWatchlistPanelState(true)).toEqual({
      addExpanded: false,
      tradeExpanded: false,
    });
  });

  it('keeps add/trade panels open on standalone watchlist routes', () => {
    expect(initialWatchlistPanelState(false)).toEqual({
      addExpanded: true,
      tradeExpanded: true,
    });
  });

  it('maps horizon ids to display labels', () => {
    expect(watchlistHorizonLabel('short_term')).toBe('Short Term');
    expect(watchlistHorizonLabel('long_term')).toBe('Long Term');
  });

  it('keeps embedded ST/LT chrome outside the list so the stock table can flex', () => {
    expect(shouldRenderWatchlistChromeOutsideList(true)).toBe(true);
    expect(shouldRenderWatchlistChromeOutsideList(false)).toBe(false);
    expect(watchlistSectionSrc).toMatch(/shouldRenderWatchlistChromeOutsideList\(embedded\)/);
    expect(watchlistSectionSrc).toMatch(/\{embeddedChrome\}/);
    expect(watchlistSectionSrc).toMatch(/const listHeader = tableHeadRow;/);
  });
});
