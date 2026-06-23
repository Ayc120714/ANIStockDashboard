/**
 * Fast API liveness probe for bootstrap — avoids blocking on heavy GET /api/system/status.
 */

const DEFAULT_PING_TIMEOUT_MS = 8_000;

function raceTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    Promise.resolve(promise)
      .then(
        value => {
          clearTimeout(timer);
          resolve(value);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        },
      );
  });
}

/**
 * @param {typeof import('../api/apiClient').apiGet} apiGet
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<boolean>}
 */
export async function pingApiLiveness(apiGet, { timeoutMs = DEFAULT_PING_TIMEOUT_MS } = {}) {
  const opts = { skipCache: true };
  try {
    await raceTimeout(apiGet('/health', opts), timeoutMs);
    return true;
  } catch (_) {
    /* fall through */
  }
  try {
    await raceTimeout(apiGet('/system/status', opts), timeoutMs);
    return true;
  } catch (_) {
    return false;
  }
}
