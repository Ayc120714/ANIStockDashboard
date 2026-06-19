import {
  activeMobileAppTab,
  detectDeviceClass,
  isPhoneUserAgent,
  isTabletUserAgent,
  resolveViewMode,
  tabMatchesPath,
} from '../utils/deviceView';

const CHROME_ANDROID_MOBILE =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36';
const FIREFOX_ANDROID_MOBILE =
  'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0';
const EDGE_ANDROID_MOBILE =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0';

describe('deviceView', () => {
  it('detects phone vs tablet user agents', () => {
    expect(isPhoneUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isTabletUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isPhoneUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari')).toBe(true);
    expect(isTabletUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X900)')).toBe(true);
    expect(isPhoneUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X900)')).toBe(false);
  });

  it('detects modern Chrome, Firefox, and Edge mobile browsers', () => {
    expect(isPhoneUserAgent(CHROME_ANDROID_MOBILE)).toBe(true);
    expect(isPhoneUserAgent(FIREFOX_ANDROID_MOBILE)).toBe(true);
    expect(isPhoneUserAgent(EDGE_ANDROID_MOBILE)).toBe(true);
    expect(resolveViewMode({ua: CHROME_ANDROID_MOBILE, width: 412})).toBe('app');
    expect(resolveViewMode({ua: FIREFOX_ANDROID_MOBILE, width: 412})).toBe('app');
    expect(resolveViewMode({ua: EDGE_ANDROID_MOBILE, width: 412})).toBe('app');
  });

  it('uses User-Agent Client Hints mobile flag before tablet heuristics', () => {
    expect(
      resolveViewMode({
        ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36',
        width: 412,
        userAgentDataMobile: true,
      }),
    ).toBe('app');
    expect(
      isTabletUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36', {
        userAgentDataMobile: true,
      }),
    ).toBe(false);
  });

  it('uses the shorter viewport side for touch phones in landscape', () => {
    expect(
      resolveViewMode({
        ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36',
        width: 915,
        minViewportSide: 412,
        touchPrimary: true,
        userAgentDataMobile: false,
      }),
    ).toBe('app');
  });

  it('falls back to narrow touch viewport when UA is ambiguous', () => {
    expect(
      resolveViewMode({
        ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36',
        width: 390,
        touchPrimary: true,
        userAgentDataMobile: false,
      }),
    ).toBe('app');
  });

  it('maps phones to app view and tablets/desktops to desktop view', () => {
    expect(resolveViewMode({ua: 'Mozilla/5.0 (iPhone)', width: 390})).toBe('app');
    expect(resolveViewMode({ua: 'Mozilla/5.0 (iPad)', width: 820})).toBe('desktop');
    expect(resolveViewMode({ua: 'Mozilla/5.0 (Windows NT 10.0)', width: 1440})).toBe('desktop');
    expect(resolveViewMode({ua: 'Mozilla/5.0 (Macintosh)', width: 800})).toBe('desktop');
    expect(detectDeviceClass({width: 600, ua: 'Mozilla/5.0 (Windows NT 10.0)'})).toBe('phone');
  });

  it('highlights signals vs advisor tabs on /advisor routes', () => {
    expect(activeMobileAppTab('/advisor', '?advisorTab=signals')).toBe('signals');
    expect(activeMobileAppTab('/advisor', '')).toBe('advisor');
    expect(tabMatchesPath({id: 'signals', match: ['/advisor']}, '/advisor', '?advisorTab=signals')).toBe(true);
    expect(tabMatchesPath({id: 'advisor', match: ['/advisor']}, '/advisor', '')).toBe(true);
    expect(activeMobileAppTab('/outlook')).toBe('stocks');
    expect(activeMobileAppTab('/')).toBe('dashboard');
  });
});
