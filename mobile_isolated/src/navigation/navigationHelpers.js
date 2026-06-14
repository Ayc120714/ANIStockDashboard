/** Bottom-tab screens inside MainTabs (not root stack routes). */
export const MAIN_TAB_NAMES = new Set(['Dashboard', 'Stocks', 'Signals', 'Screens', 'Advisor']);

const STOCK_OUTLOOK_TABS = new Set(['market', 'sector', 'sub']);

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

/**
 * Hamburger / chrome navigation: tabs via MainTabs; stack tools (Orders, Watchlist, …) on root stack.
 * Markets menu item opens Stocks tab → Market insights (same as bottom Stocks tab).
 */
export function navigateFromMenu(navigation, screen, params) {
  if (screen === 'Markets') {
    navigateToMainTab(navigation, 'Stocks', {outlookTab: 'market'});
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
  if (params !== undefined) {
    navigation.navigate(screen, params);
  } else {
    navigation.navigate(screen);
  }
}

export function isStockOutlookTab(tabId) {
  return STOCK_OUTLOOK_TABS.has(tabId);
}
