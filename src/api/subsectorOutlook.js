import { apiGet } from './apiClient';

const SUBSECTOR_GROUPED_ENDPOINT = '/subsector-outlook/grouped';

/**
 * Fetch subsector outlook with calendar week columns (W1-W52).
 * Returns { weekLabels: ['W7','W6','W5','W4'], data: [{ sector, subsectors }] }
 */
export const fetchSubsectorOutlook = async () => {
  const resp = await apiGet(SUBSECTOR_GROUPED_ENDPOINT);
  if (resp && typeof resp === 'object' && Array.isArray(resp.data)) {
    return { weekLabels: resp.weekLabels || [], data: resp.data };
  }
  return { weekLabels: [], data: [] };
};

/**
 * Fetch stocks for a specific subsector
 */
export const fetchStocksForSubsector = async (subsectorName) => {
  try {
    console.log('Fetching stocks for subsector:', subsectorName);
    const resp = await apiGet(`/subsector-stocks?subsector=${encodeURIComponent(subsectorName)}`);
    const list = resp?.data ?? [];
    console.log('Subsector stocks endpoint returned:', list.length);
    return list;
  } catch (err) {
    console.warn('Subsector stocks endpoint failed:', err?.message);
    return [];
  }
};
