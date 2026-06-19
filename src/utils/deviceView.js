/** Phone → app shell; tablet & desktop → full desktop layout (sidebar rail). */

export const PHONE_MAX_WIDTH_PX = 767;

export function readUserAgent() {
  if (typeof navigator === 'undefined') return '';
  return String(navigator.userAgent || '');
}

export function isTabletUserAgent(ua = readUserAgent()) {
  const agent = String(ua || '');
  if (/iPad/i.test(agent)) return true;
  if (/Android/i.test(agent) && !/Mobile/i.test(agent)) return true;
  if (/Tablet/i.test(agent)) return true;
  if (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}

export function isPhoneUserAgent(ua = readUserAgent()) {
  const agent = String(ua || '');
  if (isTabletUserAgent(agent)) return false;
  if (/iPhone|iPod/i.test(agent)) return true;
  if (/Android/i.test(agent) && /Mobile/i.test(agent)) return true;
  if (/Windows Phone/i.test(agent)) return true;
  return false;
}

/** Coarse device bucket used before viewport fallback. */
export function detectDeviceClass({width, ua} = {}) {
  const agent = ua ?? readUserAgent();
  if (isTabletUserAgent(agent)) return 'tablet';
  if (isPhoneUserAgent(agent)) return 'phone';

  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  if (w <= PHONE_MAX_WIDTH_PX) return 'phone';
  if (w <= 1024) return 'tablet';
  return 'desktop';
}

/** `app` = mobile app shell; `desktop` = sidebar rail layout (tablet + desktop). */
export function resolveViewMode(options) {
  const deviceClass = detectDeviceClass(options);
  return deviceClass === 'phone' ? 'app' : 'desktop';
}

export const MOBILE_APP_TABS = [
  {id: 'dashboard', label: 'Dashboard', path: '/', match: ['/'], icon: '▣'},
  {
    id: 'stocks',
    label: 'Stocks',
    path: '/outlook',
    match: ['/outlook', '/long-term', '/short-term', '/portfolio-manager', '/alerts', '/fno', '/commodities', '/forex', '/mutual-funds'],
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
