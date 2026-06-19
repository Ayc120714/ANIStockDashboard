import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {MOBILE_TIER_TABLE_PAGE_SIZE} from '@core/utils/advisorWebParity';
import {usePagedList} from '@hooks/usePagedList';

let latestPaged;

function PagedHarness({items, pageSize = MOBILE_TIER_TABLE_PAGE_SIZE, resetDeps}) {
  latestPaged = usePagedList(items, {pageSize, resetDeps});
  return null;
}

describe('advisor table page sizes', () => {
  beforeEach(() => {
    latestPaged = null;
  });

  it('custom RS table uses 5 rows per page like other advisor tier tables', () => {
    expect(MOBILE_TIER_TABLE_PAGE_SIZE).toBe(5);
  });

  it('custom RS pagination shows at most 5 rows on the first page', () => {
    const rows = Array.from({length: 18}, (_, i) => ({symbol: `SYM${i}`}));
    act(() => {
      TestRenderer.create(
        <PagedHarness items={rows} pageSize={MOBILE_TIER_TABLE_PAGE_SIZE} resetDeps={[rows.length]} />,
      );
    });
    expect(latestPaged.pagedItems).toHaveLength(5);
    expect(latestPaged.totalPages).toBe(4);
    expect(latestPaged.totalItems).toBe(18);
  });
});
