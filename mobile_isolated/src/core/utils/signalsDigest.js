/** Stable key for one advisor signal row in digest comparisons. */
export function signalDigestKey(row) {
  const sym = String(row?.symbol || '').trim();
  const status = String(row?.status || '');
  const entry = Number(row?.entry_price || 0).toFixed(2);
  const updated = String(row?.updated_at || row?.created_at || row?.signal_time || '');
  return `${sym}:${status}:${entry}:${updated}`;
}

export function signalsDigest(data) {
  return (data || [])
    .map(signalDigestKey)
    .filter(Boolean)
    .sort()
    .join('|');
}

export function diffNewSignals(prevDigest, data) {
  const prev = new Set((prevDigest || '').split('|').filter(Boolean));
  return (data || []).filter(row => {
    const key = signalDigestKey(row);
    return key && !prev.has(key);
  });
}
