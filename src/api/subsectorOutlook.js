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
export const fetchStocksForSubsector = async (subsectorName, page = 1, pageSize = 25) => {
  try {
    const resp = await apiGet(
      `/subsector-stocks?subsector=${encodeURIComponent(subsectorName)}&page=${page}&page_size=${pageSize}`
    );
    return {
      data: Array.isArray(resp?.data) ? resp.data : [],
      total: Number(resp?.total || 0),
      page: Number(resp?.page || page),
      pageSize: Number(resp?.page_size || pageSize),
    };
  } catch (err) {
    console.warn('Subsector stocks endpoint failed:', err?.message);
    return { data: [], total: 0, page, pageSize };
  }
};
