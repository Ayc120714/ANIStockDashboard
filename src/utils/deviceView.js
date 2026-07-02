/** Phone → app shell; tablet & desktop/laptop → web layout with sidebar. */

export const PHONE_MAX_WIDTH_PX = 767;

export function readUserAgent() {
  if (typeof navigator === 'undefined') return '';
  return String(navigator.userAgent || '');
}

export function readUserAgentDataMobile() {
  if (typeof navigator === 'undefined') return null;
  return navigator.userAgentData?.mobile ?? null;
}

/**
 * Layout viewport width — ignores pinch-zoom visualViewport shrink/grow so
 * app-vs-desktop shell does not flip when the user zooms in or out.
 */
export function getLayoutViewportWidth() {
  if (typeof window === 'undefined') return 1280;
  const cw = window.document?.documentElement?.clientWidth;
  const iw = window.innerWidth;
  return Math.round((cw && cw > 0 ? cw : null) ?? iw);
}

/** @deprecated Prefer getLayoutViewportWidth for layout breakpoints. */
export function getViewportWidth() {
  return getLayoutViewportWidth();
}

export function getViewportMinSide() {
  if (typeof window === 'undefined') return 1280;
  const w = getLayoutViewportWidth();
  const h = Math.round(window.innerHeight);
  return Math.min(w, h);
}

export function matchMediaQuery(query) {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}

export function isCoarsePointerEnvironment() {
  return matchMediaQuery('(pointer: coarse)') || matchMediaQuery('(hover: none)');
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
  if (platform === 'MacIntel' && maxTouchPoints > 1 && !/iPhone|iPod/i.test(agent)) return true;

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
  if (/Mobile/i.test(agent) && !/iPad|Tablet/i.test(agent)) return true;
  if (/Mobi/i.test(agent) && !/iPad|Tablet/i.test(agent)) return true;

  return false;
}

/** Laptop/desktop OS — always web layout, even with touch or a narrow window. */
export function isDesktopUserAgent(ua = readUserAgent(), options = {}) {
  if (options.userAgentDataMobile === true) return false;

  const agent = String(ua || '');
  if (isPhoneUserAgent(agent, options)) return false;
  if (isTabletUserAgent(agent, options)) return false;

  if (/Windows NT/i.test(agent)) return true;
  if (/Macintosh/i.test(agent) && !/iPhone|iPad|iPod/i.test(agent)) return true;
  if (/CrOS/i.test(agent)) return true;
  if (/X11; Linux x86_64/i.test(agent) && !/Android/i.test(agent)) return true;

  if (options.userAgentDataMobile === false) return true;

  return false;
}

export function isNarrowPhoneViewport(options = {}) {
  const width = options.width ?? getViewportWidth();
  const minSide = options.minViewportSide ?? getViewportMinSide();
  const narrowMq = matchMediaQuery(`(max-width: ${PHONE_MAX_WIDTH_PX}px)`);
  return narrowMq || width <= PHONE_MAX_WIDTH_PX || minSide <= PHONE_MAX_WIDTH_PX;
}

/**
 * True when the browser should use the mobile app shell (bottom tabs).
 * Laptops/desktops are excluded first; phones match UA, Client Hints, or phone viewport.
 */
export function shouldUseAppShell(options = {}) {
  const agent = options.ua ?? readUserAgent();
  const userAgentDataMobile = options.userAgentDataMobile ?? null;

  if (isDesktopUserAgent(agent, options)) return false;
  if (userAgentDataMobile === true) return true;
  if (isPhoneUserAgent(agent, {userAgentDataMobile})) return true;

  // Phone-sized touch viewport before tablet heuristics (Android UAs may omit "Mobile")
  if (isNarrowPhoneViewport(options) && isCoarsePointerEnvironment()) {
    return true;
  }

  if (isTabletUserAgent(agent, options)) return false;

  return false;
}

/** Coarse device bucket (phone | tablet | desktop). */
export function detectDeviceClass(options = {}) {
  if (shouldUseAppShell(options)) return 'phone';
  if (isTabletUserAgent(options.ua ?? readUserAgent(), options)) return 'tablet';
  if (isDesktopUserAgent(options.ua ?? readUserAgent(), options)) return 'desktop';
  if (isNarrowPhoneViewport(options)) return 'phone';
  const width = options.width ?? getViewportWidth();
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

/** `app` = mobile app shell; `desktop` = sidebar web layout (tablet + laptop). */
export function resolveViewMode(options = {}) {
  return shouldUseAppShell(options) ? 'app' : 'desktop';
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
  {id: 'signals', label: 'Alerts', path: '/alerts', match: ['/alerts'], icon: '⚡'},
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
    return path === '/alerts' || path.startsWith('/alerts/');
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
