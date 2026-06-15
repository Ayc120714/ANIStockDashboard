import {hydrateFromPageCache} from '@core/utils/pageCacheHydration';
import {readPageCache, writePageCache} from '@core/storage/pageCache';

describe('pageCacheHydration', () => {
  beforeEach(async () => {
    await writePageCache('@ani/test/hydrate', {rows: [1, 2]});
  });

  it('applies cached payload immediately when usable', async () => {
    const applied = [];
    const ok = await hydrateFromPageCache('@ani/test/hydrate', {
      apply: data => applied.push(data),
      hasUsable: data => Array.isArray(data?.rows) && data.rows.length > 0,
    });
    expect(ok).toBe(true);
    expect(applied).toHaveLength(1);
    expect(applied[0].rows).toEqual([1, 2]);
  });

  it('returns false when cache is missing or empty', async () => {
    const ok = await hydrateFromPageCache('@ani/test/missing', {
      apply: () => {},
      hasUsable: data => Array.isArray(data?.rows) && data.rows.length > 0,
    });
    expect(ok).toBe(false);
  });
});
