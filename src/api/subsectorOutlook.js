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
