import {cacheHasUsableData, readPageCache} from '@core/storage/pageCache';

/** Apply cached page payload immediately; returns true when cache had usable data. */
export async function hydrateFromPageCache(
  cacheKey,
  {apply, hasUsable = cacheHasUsableData} = {},
) {
  if (!cacheKey || typeof apply !== 'function') return false;
  const cached = await readPageCache(cacheKey);
  if (cached?.data != null && hasUsable(cached.data)) {
    apply(cached.data);
    return true;
  }
  return false;
}
