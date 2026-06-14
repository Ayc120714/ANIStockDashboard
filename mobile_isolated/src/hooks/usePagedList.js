import {useEffect, useMemo, useState} from 'react';

export function usePagedList(items, {pageSize = 10, resetDeps = []} = {}) {
  const [page, setPage] = useState(1);
  const list = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const resetKey = useMemo(() => resetDeps.map(String).join('\0'), [resetDeps]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, resetKey]);

  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [list, page, pageSize]);

  return {
    page,
    setPage,
    totalPages,
    pagedItems,
    pageSize,
    totalItems: list.length,
  };
}
