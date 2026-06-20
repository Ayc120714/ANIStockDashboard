import {
  activeMobileAppTab,
  detectDeviceClass,
  getLayoutViewportWidth,
  isDesktopUserAgent,
  isPhoneUserAgent,
  isTabletUserAgent,
  resolveViewMode,
  shouldUseAppShell,
  tabMatchesPath,
} from '../utils/deviceView';

const CHROME_ANDROID_MOBILE =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36';
const FIREFOX_ANDROID_MOBILE =
  'Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0';
const EDGE_ANDROID_MOBILE =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 EdgA/120.0.0.0';
const WINDOWS_CHROME_LAPTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

describe('deviceView', () => {
  it('detects phone vs tablet user agents', () => {
    expect(isPhoneUserAgent(IPHONE_SAFARI)).toBe(true);
    expect(isTabletUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isPhoneUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari')).toBe(true);
    expect(isTabletUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X900)')).toBe(true);
    expect(isPhoneUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X900)')).toBe(false);
  });

  it('detects modern Chrome, Firefox, and Edge mobile browsers', () => {
    expect(isPhoneUserAgent(CHROME_ANDROID_MOBILE)).toBe(true);
    expect(isPhoneUserAgent(FIREFOX_ANDROID_MOBILE)).toBe(true);
    expect(isPhoneUserAgent(EDGE_ANDROID_MOBILE)).toBe(true);
    expect(shouldUseAppShell({ua: CHROME_ANDROID_MOBILE, width: 412, userAgentDataMobile: true})).toBe(true);
    expect(shouldUseAppShell({ua: FIREFOX_ANDROID_MOBILE, width: 412})).toBe(true);
    expect(resolveViewMode({ua: EDGE_ANDROID_MOBILE, width: 412})).toBe('app');
  });

  it('uses User-Agent Client Hints mobile flag', () => {
    expect(
      shouldUseAppShell({
        ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36',
        width: 412,
        userAgentDataMobile: true,
      }),
    ).toBe(true);
    expect(
      isTabletUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/143.0.0.0 Safari/537.36', {
        userAgentDataMobile: true,
      }),
    ).toBe(false);
  });

  it('keeps laptops on desktop web layout even with touch and narrow windows', () => {
    expect(isDesktopUserAgent(WINDOWS_CHROME_LAPTOP, {userAgentDataMobile: false})).toBe(true);
    expect(
      shouldUseAppShell({
        ua: WINDOWS_CHROME_LAPTOP,
        width: 1440,
        userAgentDataMobile: false,
        maxTouchPoints: 10,
      }),
    ).toBe(false);
    expect(
      resolveViewMode({
        ua: WINDOWS_CHROME_LAPTOP,
        width: 600,
        userAgentDataMobile: false,
        maxTouchPoints: 10,
      }),
    ).toBe('desktop');
    expect(detectDeviceClass({width: 600, ua: WINDOWS_CHROME_LAPTOP, userAgentDataMobile: false})).toBe('desktop');
  });

  it('uses phone landscape viewport for mobile Chrome', () => {
    expect(
      shouldUseAppShell({
        ua: CHROME_ANDROID_MOBILE,
        width: 915,
        minViewportSide: 412,
        userAgentDataMobile: true,
      }),
    ).toBe(true);
  });

  it('falls back to narrow coarse-pointer viewport when UA is ambiguous', () => {
    expect(
      shouldUseAppShell({
        ua: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/143.0.0.0 Mobile Safari/537.36',
        width: 390,
        minViewportSide: 390,
        userAgentDataMobile: null,
      }),
    ).toBe(true);
  });

  it('does not treat desktop-site mode on phone as app shell when desktop UA is sent', () => {
    expect(
      shouldUseAppShell({
        ua: WINDOWS_CHROME_LAPTOP,
        width: 390,
        minViewportSide: 390,
        userAgentDataMobile: false,
      }),
    ).toBe(false);
  });

  it('maps phones to app view and tablets/desktops to desktop view', () => {
    expect(resolveViewMode({ua: IPHONE_SAFARI, width: 390})).toBe('app');
    expect(resolveViewMode({ua: 'Mozilla/5.0 (iPad)', width: 820})).toBe('desktop');
    expect(resolveViewMode({ua: 'Mozilla/5.0 (Windows NT 10.0)', width: 1440})).toBe('desktop');
    expect(resolveViewMode({ua: 'Mozilla/5.0 (Macintosh)', width: 800})).toBe('desktop');
  });

  it('highlights signals vs advisor tabs on /advisor routes', () => {
    expect(activeMobileAppTab('/advisor', '?advisorTab=signals')).toBe('signals');
    expect(activeMobileAppTab('/advisor', '')).toBe('advisor');
    expect(tabMatchesPath({id: 'signals', match: ['/advisor']}, '/advisor', '?advisorTab=signals')).toBe(true);
    expect(tabMatchesPath({id: 'advisor', match: ['/advisor']}, '/advisor', '')).toBe(true);
    expect(activeMobileAppTab('/outlook')).toBe('stocks');
    expect(activeMobileAppTab('/')).toBe('dashboard');
  });

  it('keeps phone user on app shell when zoom inflates reported width', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 390 });
    expect(getLayoutViewportWidth()).toBe(390);
    expect(
      resolveViewMode({
        ua: IPHONE_SAFARI,
        width: getLayoutViewportWidth(),
        minViewportSide: 390,
      }),
    ).toBe('app');
    expect(
      resolveViewMode({
        ua: IPHONE_SAFARI,
        width: 820,
        minViewportSide: 390,
      }),
    ).toBe('app');
  });
});
