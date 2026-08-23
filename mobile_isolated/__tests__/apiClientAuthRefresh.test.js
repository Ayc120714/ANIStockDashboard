import {isPublicAuthEndpoint} from '@core/api/apiClient';

describe('apiClient auth 401 handling', () => {
  it('treats auth/refresh as a public endpoint so 401 cannot recurse into refresh', () => {
    // Bug: dead refresh tokens caused 401 → refresh → 401 loops and an endless
    // "Loading dashboard…" screen with no data (okhttp only hit DOWNLOAD.json).
    expect(isPublicAuthEndpoint('/auth/refresh')).toBe(true);
    expect(isPublicAuthEndpoint('auth/refresh')).toBe(true);
    expect(isPublicAuthEndpoint('/auth/me')).toBe(true);
    expect(isPublicAuthEndpoint('/auth/login')).toBe(true);
    expect(isPublicAuthEndpoint('/market-indices/')).toBe(false);
    expect(isPublicAuthEndpoint('/stocks/price-shockers?limit=8')).toBe(false);
  });
});
