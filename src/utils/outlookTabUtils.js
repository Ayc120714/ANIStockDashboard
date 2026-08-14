export const OUTLOOK_TAB_IDS = ['daily', 'market', 'sector', 'subsector'];

/** Normalize ?outlookTab= query value to a stable tab id. */
export function resolveOutlookTab(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (key === 'daily' || key === 'daily-update' || key === 'update') return 'daily';
  if (key === 'sub' || key === 'subsector') return 'subsector';
  if (key === 'sector') return 'sector';
  return 'market';
}

export function outlookTabToParam(tabId) {
  const resolved = resolveOutlookTab(tabId);
  if (resolved === 'subsector') return 'subsector';
  if (resolved === 'daily') return 'daily';
  return resolved;
}

export function buildOutlookSearchParams(currentParams, { tab, sector = null, clearSector = false } = {}) {
  const next = new URLSearchParams(currentParams?.toString?.() ?? String(currentParams || ''));
  if (tab != null) {
    next.set('outlookTab', outlookTabToParam(tab));
  }
  if (clearSector) {
    next.delete('sector');
  } else if (sector) {
    next.set('sector', sector);
  }
  return next;
}
