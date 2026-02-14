import { apiGet } from './apiClient';

const SECTOR_OUTLOOK_ENDPOINT = '/sector-outlook';

export const fetchSectorOutlook = async () => {
  const data = await apiGet(SECTOR_OUTLOOK_ENDPOINT);
  return Array.isArray(data) ? data : [];
};
