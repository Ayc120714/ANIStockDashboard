import {apiGet} from '@core/api/apiClient';

/**
 * Same contract as web: `GET /api/advisor/signals/latest` (auth required).
 * `status` includes `entry_ready`, `in_trade`, `exit_watch`, `done` (see advisor.py).
 */
export const signalsService = {
  fetchLatestSignals: (params = {}) => {
    const q = new URLSearchParams();
    const limit = params.limit ?? 120;
    q.set('limit', String(limit));
    if (params.max_entry_gap_pct != null) {
      q.set('max_entry_gap_pct', String(params.max_entry_gap_pct));
    }
    if (params.monthly_entry_only) {
      q.set('monthly_entry_only', 'true');
    }
    const suffix = `?${q.toString()}`;
    const timeoutMs = params.timeoutMs ?? 60_000;
    return apiGet(`/advisor/signals/latest${suffix}`, {timeoutMs});
  },
};
