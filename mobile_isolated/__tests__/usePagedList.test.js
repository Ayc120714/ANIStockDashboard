import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {usePagedList} from '@hooks/usePagedList';

let latestPaged;

function PagedHarness({items, pageSize = 3, resetDeps}) {
  latestPaged = usePagedList(items, {pageSize, resetDeps});
  return null;
}

describe('usePagedList pagination fixes', () => {
  beforeEach(() => {
    latestPaged = null;
  });

  it('pages items without resetting when resetDeps is omitted', () => {
    const items = ['A', 'B', 'C', 'D', 'E'];
    act(() => {
      TestRenderer.create(<PagedHarness items={items} pageSize={2} />);
    });
    expect(latestPaged.page).toBe(1);
    expect(latestPaged.pagedItems).toEqual(['A', 'B']);
    expect(latestPaged.totalPages).toBe(3);

    act(() => {
      latestPaged.setPage(2);
    });
    expect(latestPaged.page).toBe(2);
    expect(latestPaged.pagedItems).toEqual(['C', 'D']);
  });

  it('resets to page 1 when resetDeps change', () => {
    const items = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <PagedHarness items={items} pageSize={3} resetDeps={['all']} />,
      );
    });
    act(() => {
      latestPaged.setPage(2);
    });
    expect(latestPaged.page).toBe(2);

    act(() => {
      renderer.update(
        <PagedHarness items={items.slice(0, 3)} pageSize={3} resetDeps={['short']} />,
      );
    });
    expect(latestPaged.page).toBe(1);
    expect(latestPaged.pagedItems).toEqual(['A', 'B', 'C']);
  });

  it('clamps page when list shrinks', () => {
    let items = ['A', 'B', 'C', 'D', 'E', 'F'];
    let renderer;
    act(() => {
      renderer = TestRenderer.create(<PagedHarness items={items} pageSize={2} />);
    });
    act(() => {
      latestPaged.setPage(3);
    });
    expect(latestPaged.page).toBe(3);

    items = ['A', 'B'];
    act(() => {
      renderer.update(<PagedHarness items={items} pageSize={2} />);
    });
    expect(latestPaged.page).toBe(1);
    expect(latestPaged.totalPages).toBe(1);
  });

  it('handles non-array items as empty list', () => {
    act(() => {
      TestRenderer.create(<PagedHarness items={null} pageSize={5} />);
    });
    expect(latestPaged.totalItems).toBe(0);
    expect(latestPaged.pagedItems).toEqual([]);
    expect(latestPaged.totalPages).toBe(1);
  });
});
