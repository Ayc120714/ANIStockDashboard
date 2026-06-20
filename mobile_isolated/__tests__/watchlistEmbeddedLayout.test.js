import {
  initialWatchlistPanelState,
  watchlistHorizonLabel,
} from '@features/stocks/watchlistEmbeddedLayout';

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
});
