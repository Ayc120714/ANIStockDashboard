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

export async function safeFetch(
  fetcher,
  {timeoutMs = 30_000, label = 'Request', fallback = null, retries = 1} = {},
) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await withTimeout(fetcher(), timeoutMs, label);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
    }
  }
  if (fallback !== undefined && fallback !== null) return fallback;
  if (lastError) throw lastError;
  return fallback;
}
