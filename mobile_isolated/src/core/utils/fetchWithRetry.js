import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';

const TIMEOUT_MSG = /timed out|timeout|abort|network|reach server/i;

export async function fetchWithRetry(fetcher, {retries = 1} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetcher();
    } catch (error) {
      lastError = error;
      const msg = String(error?.message || error || '');
      if (!TIMEOUT_MSG.test(msg) || attempt >= retries) {
        break;
      }
    }
  }
  throw lastError || new Error('Failed to load data.');
}
