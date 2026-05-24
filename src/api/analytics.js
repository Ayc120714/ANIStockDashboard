import { apiGet, apiPost } from './apiClient';

/** Record SPA route view (debounced client-side). */
export const recordPageView = (path) =>
  apiPost('/analytics/page-view', { path: String(path || '/') }).catch(() => null);

/** Super-admin traffic summary. */
export const fetchAdminPageVisitStats = () => apiGet('/analytics/admin/page-visit-stats');
