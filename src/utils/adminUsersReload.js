import { clearApiGetCache } from '../api/apiClient';
import { fetchAdminUsers } from '../api/auth';

/**
 * Admin directory must bypass GET cache after tier-changing mutations.
 * Regression: user stayed in old tier table until hard refresh when cache was stale.
 */
export async function fetchFreshAdminUsers(includeInactive = true) {
  clearApiGetCache();
  return fetchAdminUsers(includeInactive, { skipCache: true });
}
