import {useCallback, useState} from 'react';
import {toggleSortConfig} from '@core/utils/tableSort';

export function useTableSort(initialKey = null, initialAscending = false) {
  const [sortConfig, setSortConfig] = useState({
    key: initialKey,
    ascending: initialAscending,
  });

  const onSort = useCallback(key => {
    setSortConfig(prev => toggleSortConfig(prev, key));
  }, []);

  const resetSort = useCallback(() => {
    setSortConfig({key: initialKey, ascending: initialAscending});
  }, [initialAscending, initialKey]);

  return {sortConfig, onSort, resetSort, setSortConfig};
}
