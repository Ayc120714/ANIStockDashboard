/** Build in-app banner + system notification copy for new advisor signals. */

export function buildSignalNotificationPayload(freshSignals = []) {
  const fresh = Array.isArray(freshSignals) ? freshSignals : [];
  if (!fresh.length) {
    return null;
  }

  const names = fresh
    .slice(0, 4)
    .map(r => String(r?.symbol || '').trim())
    .filter(Boolean)
    .join(', ');

  const entryReady = fresh.filter(r => String(r?.status) === 'entry_ready');

  if (entryReady.length) {
    const countLabel = entryReady.length > 1 ? 's' : '';
    return {
      title: `Entry ready · ${entryReady.length} signal${countLabel}`,
      message: names || 'Tap to view signals',
      entryHint: `New entry-ready signal${countLabel}: ${names}. Tap to open.`,
      navTarget: {type: 'signals'},
      entryReadyCount: entryReady.length,
      totalCount: fresh.length,
    };
  }

  const countLabel = fresh.length > 1 ? 's' : '';
  return {
    title: `New advisor signal${countLabel}`,
    message: names || 'Tap to view signals',
    entryHint: `New advisor signal${countLabel}: ${names}. Tap to open.`,
    navTarget: {type: 'signals'},
    entryReadyCount: 0,
    totalCount: fresh.length,
  };
}
