import {apiGet} from '@core/api/apiClient';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';

export const marketsService = {
  fetchFnoSummary: (opts = {}) =>
    apiGet('/fno/summary', {timeoutMs: opts.timeoutMs ?? API_TIMEOUT_MS.screen}),
  fetchCommoditiesSummary: (opts = {}) =>
    apiGet('/commodities/summary', {timeoutMs: opts.timeoutMs ?? API_TIMEOUT_MS.screen}),
  fetchForexSummary: (opts = {}) =>
    apiGet('/forex/summary', {timeoutMs: opts.timeoutMs ?? API_TIMEOUT_MS.screen}),
};
