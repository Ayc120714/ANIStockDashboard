/**
 * Pure helpers for Hot Subsectors Advisor tab (mobile).
 */

export function filterHotSubsectorGroups(groups, threshold = 75) {
  const list = Array.isArray(groups) ? groups : [];
  return list.filter(g => {
    const all = Number(g?.all);
    return Number.isFinite(all) && all > threshold;
  });
}

export function normalizeHotSubsectorsPayload(payload) {
  const list = Array.isArray(payload?.subsectors)
    ? payload.subsectors
    : Array.isArray(payload?.data)
      ? payload.data
      : [];
  const threshold = Number(payload?.threshold_all);
  const t = Number.isFinite(threshold) ? threshold : 75;
  return {
    threshold_all: t,
    subsectors: filterHotSubsectorGroups(list, t),
  };
}
