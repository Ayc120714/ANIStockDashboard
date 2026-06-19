import {
  activeMobileAppTab,
  detectDeviceClass,
  isPhoneUserAgent,
  isTabletUserAgent,
  resolveViewMode,
  tabMatchesPath,
} from '../utils/deviceView';

describe('deviceView', () => {
  it('detects phone vs tablet user agents', () => {
    expect(isPhoneUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isTabletUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isPhoneUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari')).toBe(true);
    expect(isTabletUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X900)')).toBe(true);
    expect(isPhoneUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X900)')).toBe(false);
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
