/**
 * Pure helpers for Hot Subsectors Advisor tab (web + shared tests).
 */

export function filterHotSubsectorGroups(groups, threshold = 75) {
  const list = Array.isArray(groups) ? groups : [];
  return list.filter((g) => {
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
  return {
    threshold_all: Number.isFinite(threshold) ? threshold : 75,
    subsectors: filterHotSubsectorGroups(list, Number.isFinite(threshold) ? threshold : 75),
  };
}
