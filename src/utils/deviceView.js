/** Phone → app shell; tablet & desktop → full desktop layout (sidebar rail). */

export const PHONE_MAX_WIDTH_PX = 767;

export function readUserAgent() {
  if (typeof navigator === 'undefined') return '';
  return String(navigator.userAgent || '');
}

export function readUserAgentDataMobile() {
  if (typeof navigator === 'undefined') return null;
  return navigator.userAgentData?.mobile ?? null;
}

export function getViewportWidth() {
  if (typeof window === 'undefined') return 1280;
  return Math.round(window.visualViewport?.width ?? window.innerWidth);
}

export function getViewportMinSide() {
  if (typeof window === 'undefined') return 1280;
  const w = window.visualViewport?.width ?? window.innerWidth;
  const h = window.visualViewport?.height ?? window.innerHeight;
  return Math.round(Math.min(w, h));
}

export function isTouchPrimaryDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (window.matchMedia?.('(pointer: coarse)').matches) return true;
  return (navigator.maxTouchPoints ?? 0) > 0;
}

export function readClientPlatformHints() {
  if (typeof navigator === 'undefined') {
    return {platform: '', maxTouchPoints: 0, userAgentDataMobile: null};
  }
  return {
    platform: String(navigator.platform || ''),
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    userAgentDataMobile: readUserAgentDataMobile(),
  };
}

export function buildDeviceViewContext(overrides = {}) {
  const hints = readClientPlatformHints();
  return {
    width: getViewportWidth(),
    minViewportSide: getViewportMinSide(),
    ua: readUserAgent(),
    userAgentDataMobile: hints.userAgentDataMobile,
    platform: hints.platform,
    maxTouchPoints: hints.maxTouchPoints,
    touchPrimary: isTouchPrimaryDevice(),
    ...overrides,
  };
}

export function isTabletUserAgent(ua = readUserAgent(), options = {}) {
  const agent = String(ua || '');
  const userAgentDataMobile = options.userAgentDataMobile ?? null;
  if (userAgentDataMobile === true) return false;

  if (/iPhone|iPod/i.test(agent)) return false;
  if (/iPad/i.test(agent)) return true;
  if (/Android/i.test(agent) && (/Mobile/i.test(agent) || /Mobi/i.test(agent))) return false;
  if (/Android/i.test(agent)) return true;
  if (/Tablet/i.test(agent)) return true;

  const platform = options.platform ?? (typeof navigator !== 'undefined' ? navigator.platform : '');
  const maxTouchPoints = options.maxTouchPoints
    ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0);
  if (platform === 'MacIntel' && maxTouchPoints > 1) return true;

  return false;
}

export function isPhoneUserAgent(ua = readUserAgent(), options = {}) {
  const agent = String(ua || '');
  const userAgentDataMobile = options.userAgentDataMobile ?? null;
  if (userAgentDataMobile === true) return true;

  if (/iPhone|iPod/i.test(agent)) return true;
  if (/Android/i.test(agent) && (/Mobile/i.test(agent) || /Mobi/i.test(agent))) return true;
  if (/Windows Phone/i.test(agent)) return true;
  if (/EdgA\/|EdgiOS\//i.test(agent)) return true;
  if (/Mobi/i.test(agent) && !/iPad|Tablet/i.test(agent)) return true;

  return false;
}

export function isDesktopUserAgent(ua = readUserAgent(), options = {}) {
  if (options.userAgentDataMobile === true) return false;
  if (options.userAgentDataMobile === false) return true;
  const agent = String(ua || '');
  if (isPhoneUserAgent(agent, options)) return false;
  if (isTabletUserAgent(agent, options)) return false;
  if (/Windows NT/i.test(agent)) return true;
  if (/Macintosh/i.test(agent) && !/iPhone|iPad|iPod/i.test(agent)) return true;
  if (/CrOS/i.test(agent)) return true;
  if (/X11; Linux x86_64/i.test(agent) && !/Android/i.test(agent)) return true;
  return false;
}

/** Coarse device bucket used before viewport fallback. */
export function detectDeviceClass(options = {}) {
  const agent = options.ua ?? readUserAgent();
  const userAgentDataMobile = options.userAgentDataMobile ?? null;
  const width = options.width ?? getViewportWidth();
  const minViewportSide = options.minViewportSide ?? width;
  const tabletOptions = {
    userAgentDataMobile,
    platform: options.platform,
    maxTouchPoints: options.maxTouchPoints,
  };

  if (userAgentDataMobile === true) return 'phone';
  if (isPhoneUserAgent(agent, {userAgentDataMobile})) return 'phone';
  if (isTabletUserAgent(agent, tabletOptions)) return 'tablet';

  if (isDesktopUserAgent(agent, options)) {
    return width <= 1024 ? 'tablet' : 'desktop';
  }

  if (width <= PHONE_MAX_WIDTH_PX || minViewportSide <= PHONE_MAX_WIDTH_PX) return 'phone';

  if (width <= 1024) return 'tablet';
  return 'desktop';
}

/** `app` = mobile app shell; `desktop` = sidebar rail layout (tablet + desktop). */
export function resolveViewMode(options = {}) {
  const deviceClass = detectDeviceClass(options);
  return deviceClass === 'phone' ? 'app' : 'desktop';
}

export const MOBILE_APP_TABS = [
  {id: 'dashboard', label: 'Dashboard', path: '/', match: ['/'], icon: '▣'},
  {
    id: 'stocks',
    label: 'Stocks',
    path: '/outlook',
    match: ['/outlook', '/long-term', '/short-term', '/portfolio-manager', '/fno', '/commodities', '/forex', '/mutual-funds'],
    icon: '◎',
  },
  {id: 'signals', label: 'Signals', path: '/advisor?advisorTab=signals', match: ['/advisor'], icon: '⚡'},
  {id: 'screens', label: 'Screens', path: '/screens', match: ['/screens', '/video-screener'], icon: '▤'},
  {id: 'advisor', label: 'Advisor', path: '/advisor', match: ['/advisor', '/next-week-setup'], icon: '✦'},
];

export function tabMatchesPath(tab, pathname, search = '') {
  const path = String(pathname || '/');
  const matches = tab.match || [tab.path.split('?')[0]];
  if (!matches.some(prefix => path === prefix || (prefix !== '/' && path.startsWith(`${prefix}/`)))) {
    return false;
  }
  if (tab.id === 'signals') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const advisorTab = params.get('advisorTab');
    return advisorTab === 'signals' || advisorTab === 'sig';
  }
  if (tab.id === 'advisor' && path === '/advisor') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const advisorTab = params.get('advisorTab');
    if (advisorTab === 'signals' || advisorTab === 'sig') return false;
  }
  return true;
}

export function activeMobileAppTab(pathname, search = '') {
  for (const tab of MOBILE_APP_TABS) {
    if (tabMatchesPath(tab, pathname, search)) return tab.id;
  }
  return null;
}
