import {apiGet} from '@core/api/apiClient';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {parseAdvisorListResponse} from '@core/utils/webParity';

/**
 * Same contract as web: `GET /api/advisor/signals/latest` (auth required).
 * Returns row array from `payload.data` — same as web `fetchLatestSignals`.
 */
export const signalsService = {
  fetchLatestSignals: async (params = {}) => {
    const q = new URLSearchParams();
    const limit = params.limit ?? 200;
    q.set('limit', String(limit));
    if (params.max_entry_gap_pct != null) {
      q.set('max_entry_gap_pct', String(params.max_entry_gap_pct));
    }
    if (params.monthly_entry_only) {
      q.set('monthly_entry_only', 'true');
    }
    if (params.mobile_lite || limit <= 25) {
      q.set('mobile_lite', 'true');
    }
    const suffix = `?${q.toString()}`;
    const timeoutMs = params.timeoutMs ?? API_TIMEOUT_MS.advisor;
    return parseAdvisorListResponse(await apiGet(`/advisor/signals/latest${suffix}`, {timeoutMs}));
  },
  /** Full payload when screens need high_conviction meta (web: fetchLatestSignalsPayload). */
  fetchLatestSignalsPayload: async (params = {}) => {
    const q = new URLSearchParams();
    q.set('limit', String(params.limit ?? 200));
    if (params.max_entry_gap_pct != null) {
      q.set('max_entry_gap_pct', String(params.max_entry_gap_pct));
    }
    if (params.monthly_entry_only) {
      q.set('monthly_entry_only', 'true');
    }
    return apiGet(`/advisor/signals/latest?${q.toString()}`, {
      timeoutMs: params.timeoutMs ?? API_TIMEOUT_MS.advisor,
    });
  },
};
