import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {safeFetch} from '@core/utils/safeFetch';

export const FETCH_HEAVY = {timeoutMs: API_TIMEOUT_MS.screenHeavy, retries: 1};
export const FETCH_SCREEN = {timeoutMs: API_TIMEOUT_MS.screen, retries: 1};
export const FETCH_DEFAULT = {timeoutMs: API_TIMEOUT_MS.default, retries: 1};
export const FETCH_ADVISOR = {timeoutMs: API_TIMEOUT_MS.advisor, retries: 1};

/** Wrap a screen API call with standard timeout + one retry. */
export function fetchScreenData(fetcher, {label = 'Request', heavy = false, advisor = false, timeoutMs} = {}) {
  const base = advisor ? FETCH_ADVISOR : heavy ? FETCH_HEAVY : FETCH_SCREEN;
  return safeFetch(fetcher, {
    ...base,
    timeoutMs: timeoutMs ?? base.timeoutMs,
    label,
    fallback: null,
  });
}

export async function fetchScreenDataOrThrow(fetcher, opts = {}, timeoutMessage) {
  const result = await fetchScreenData(fetcher, opts);
  if (result == null) {
    throw new Error(timeoutMessage || `${opts.label || 'Request'} timed out. Pull down to retry.`);
  }
  return result;
}

export function mergeApiOpts(opts = {}, ms = API_TIMEOUT_MS.screen) {
  return {...opts, timeoutMs: opts.timeoutMs ?? ms};
}
