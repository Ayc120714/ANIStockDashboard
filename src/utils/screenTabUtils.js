export const SCREEN_TABS = ['AI Picks', 'Trending', 'Top Movers', 'Volume Movers', 'Alpha Tracker', 'IPOs'];

const SCREEN_TAB_PARAM_MAP = {
  'ai picks': 'ai-picks',
  trending: 'trending',
  'top movers': 'top-movers',
  'volume movers': 'volume-movers',
  'alpha tracker': 'alpha-tracker',
  ipos: 'ipos',
};

const SCREEN_TAB_FROM_PARAM = {
  'ai-picks': 'AI Picks',
  trending: 'Trending',
  'top-movers': 'Top Movers',
  'volume-movers': 'Volume Movers',
  'alpha-tracker': 'Alpha Tracker',
  ipos: 'IPOs',
};

/** Normalize ?screenTab= query value to a Screens page tab label. */
export function resolveScreenTab(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return 'AI Picks';
  if (SCREEN_TAB_FROM_PARAM[key]) return SCREEN_TAB_FROM_PARAM[key];
  const match = SCREEN_TABS.find((label) => label.toLowerCase() === key);
  return match || 'AI Picks';
}

export function screenTabToParam(tabLabel) {
  const key = String(tabLabel || '').trim().toLowerCase();
  return SCREEN_TAB_PARAM_MAP[key] || 'ai-picks';
}
