import {INBOX_SOURCES} from '@core/utils/alertInboxUtils';

/** Bottom-tab screens inside MainTabs (not root stack routes). */
export const MAIN_TAB_NAMES = new Set(['Dashboard', 'Stocks', 'Signals', 'Screens', 'Advisor']);

/** True when `navigation` is the bottom-tab navigator (not the root stack). */
export function isInsideMainTabs(navigation) {
  const state = navigation?.getState?.();
  if (!state?.routes?.length) return false;
  return state.routes.some(route => MAIN_TAB_NAMES.has(route.name));
}

/** Walk to the root stack navigator (for Admin, WebPortal, etc.). */
export function getRootNavigation(navigation) {
  let nav = navigation;
  let parent = navigation?.getParent?.();
  while (parent) {
    nav = parent;
    parent = parent.getParent?.();
  }
  return nav;
}

const STOCK_OUTLOOK_TABS = new Set(['market', 'sector', 'sub']);
const STOCK_WATCHLIST_TABS = new Set(['long_term', 'short_term']);
const STOCK_TOOL_TABS = new Set(['orders', 'brokers', 'alerts']);
const STOCK_TAB_IDS = new Set([...STOCK_OUTLOOK_TABS, ...STOCK_WATCHLIST_TABS, ...STOCK_TOOL_TABS]);
const STOCK_EMBEDDED_TABS = new Set([...STOCK_WATCHLIST_TABS, ...STOCK_TOOL_TABS]);

/** Resolve active tab name from tab or stack navigators. */
export function getActiveMainTabName(navigation) {
  let state = navigation?.getState?.();
  let depth = 0;
  while (state && depth < 8) {
    const route = state.routes?.[state.index ?? 0];
    if (!route) break;
    if (route.name === 'MainTabs' && route.state) {
      const tabRoute = route.state.routes?.[route.state.index ?? 0];
      return tabRoute?.name;
    }
    if (MAIN_TAB_NAMES.has(route.name)) {
      return route.name;
    }
    if (!route.state) break;
    state = route.state;
    depth += 1;
  }
  return undefined;
}

/** Navigate to a bottom-tab screen (works from stack screens and from tabs). */
export function navigateToMainTab(navigation, tabName, params) {
  if (!navigation?.navigate) return;
  if (isInsideMainTabs(navigation)) {
    if (params !== undefined) {
      navigation.navigate({name: tabName, params, merge: true});
    } else {
      navigation.navigate(tabName);
    }
    return;
  }
  if (params !== undefined) {
    navigation.navigate({
      name: 'MainTabs',
      params: {screen: tabName, params},
      merge: true,
    });
    return;
  }
  navigation.navigate('MainTabs', {screen: tabName});
}

/** Open a Stocks hub sub-tab (Market, LT watchlist, Orders, …). */
export function navigateToStocksOutlookTab(navigation, outlookTab, extraParams = {}) {
  navigateToMainTab(navigation, 'Stocks', {outlookTab, ...extraParams});
}

export function navigateToStocksOrders(navigation, ordersParams = {}) {
  navigateToStocksOutlookTab(navigation, 'orders', {ordersParams});
}

export function navigateToStocksBrokers(navigation, brokersParams = {}) {
  navigateToStocksOutlookTab(navigation, 'brokers', {brokersParams});
}

export function navigateToStocksAlerts(navigation) {
  navigateToStocksOutlookTab(navigation, 'alerts');
}

export function navigateToAdvisorTab(navigation, advisorTab = 'sig', extraParams = {}) {
  navigateToMainTab(navigation, 'Advisor', {advisorTab, ...extraParams});
}

export function navigateToScreensMain(navigation, screensMain = 'movers') {
  navigateToMainTab(navigation, 'Screens', {screensMain});
}

/** Navigate to a root stack screen (Admin, WebPortal, …). */
export function navigateToRootScreen(navigation, screen, params) {
  const root = getRootNavigation(navigation);
  if (!root?.navigate) return;
  if (params !== undefined) {
    root.navigate(screen, params);
  } else {
    root.navigate(screen);
  }
}

/**
 * Bell inbox row → Advisor / Screens / Signals / Stocks alerts (or Admin on root stack).
 * @param {import('@core/utils/alertInboxUtils').INBOX_SOURCES} item.source
 */
export function navigateFromInboxItem(navigation, item, target) {
  if (!navigation?.navigate || !item) return;
  if (item.source === INBOX_SOURCES.ADMIN) {
    navigateToRootScreen(navigation, 'Admin');
    return;
  }
  if (target?.type === 'advisor' && target.advisorTab) {
    navigateToAdvisorTab(navigation, target.advisorTab, {trendTf: target.trendTf});
    return;
  }
  if (target?.type === 'screens' && target.screensMain) {
    navigateToScreensMain(navigation, target.screensMain);
    return;
  }
  if (target?.type === 'signals') {
    navigateToMainTab(navigation, 'Signals');
    return;
  }
  if (target?.type === 'stocks_alerts') {
    navigateToStocksAlerts(navigation);
    return;
  }
  navigateToStocksAlerts(navigation);
}

/**
 * Hamburger / chrome navigation: tabs via MainTabs; legacy stack routes redirect into Stocks sub-tabs.
 */
export function navigateFromMenu(navigation, screen, params) {
  if (screen === 'Markets') {
    navigateToStocksOutlookTab(navigation, 'market');
    return;
  }
  if (screen === 'Watchlist') {
    const outlookTab = params?.listType === 'short_term' ? 'short_term' : 'long_term';
    navigateToStocksOutlookTab(navigation, outlookTab);
    return;
  }
  if (screen === 'Orders') {
    navigateToStocksOrders(navigation, params || {});
    return;
  }
  if (screen === 'Brokers') {
    navigateToStocksBrokers(navigation, params || {});
    return;
  }
  if (screen === 'Alerts') {
    navigateToStocksAlerts(navigation);
    return;
  }
  if (screen === 'Signals') {
    navigateToMainTab(navigation, 'Signals');
    return;
  }
  if (MAIN_TAB_NAMES.has(screen)) {
    navigateToMainTab(navigation, screen, params);
    return;
  }
  navigateToRootScreen(navigation, screen, params);
}

export function isStockTabId(tabId) {
  return STOCK_TAB_IDS.has(tabId);
}

export function isStockOutlookTab(tabId) {
  return STOCK_OUTLOOK_TABS.has(tabId);
}

export function isWatchlistTabId(tabId) {
  return STOCK_WATCHLIST_TABS.has(tabId);
}

export function isStockToolTabId(tabId) {
  return STOCK_TOOL_TABS.has(tabId);
}

export function isStockEmbeddedTabId(tabId) {
  return STOCK_EMBEDDED_TABS.has(tabId);
}
