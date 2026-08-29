import { IPO_SESSION_CACHE_PREFIX, IPO_STATUS_FILTERS } from './ipoScreenFilters';

describe('IPO screen filters', () => {
  it('includes Forthcoming so current Chittorgarh issues are reachable without All', () => {
    const values = IPO_STATUS_FILTERS.map((f) => f.value);
    expect(values).toContain(null);
    expect(values).toContain('Active');
    expect(values).toContain('Forthcoming');
    expect(values).toContain('Closed');
    expect(values).toContain('Listed');
  });

  it('bumps session cache prefix so stale empty/junk IPO payloads are not reused', () => {
    expect(IPO_SESSION_CACHE_PREFIX).toBe('iposData_v2');
  });
});
