/** Per-call timeout wrapper — avoids one slow endpoint blocking the whole screen. */
export function withTimeout(promise, ms, label = 'Request') {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    Promise.resolve(promise)
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function safeFetch(fetcher, {timeoutMs = 8000, label = 'Request', fallback = null} = {}) {
  try {
    return await withTimeout(fetcher(), timeoutMs, label);
  } catch {
    return fallback;
  }
}
