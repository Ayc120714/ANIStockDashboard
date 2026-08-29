import {IPO_STATUS_FILTERS} from '@core/utils/ipoScreenFilters';

describe('IPO screen filters', () => {
  it('includes Forthcoming so current Chittorgarh issues are reachable without All', () => {
    const ids = IPO_STATUS_FILTERS.map(f => f.id);
    expect(ids).toEqual(['', 'Active', 'Forthcoming', 'Listed', 'Closed']);
  });
});
