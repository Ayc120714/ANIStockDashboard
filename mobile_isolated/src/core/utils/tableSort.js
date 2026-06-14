/** Web-style table sort: tap header toggles asc/desc; third tap on new column starts asc. */
export function toggleSortConfig(prev, key) {
  return {
    key,
    ascending: prev?.key === key ? !prev?.ascending : true,
  };
}

export function sortIndicator(config, key) {
  if (config?.key !== key) return '';
  return config.ascending ? ' ↑' : ' ↓';
}

export function parseSortNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function compareSortValues(a, b, ascending = true) {
  const aNull = a == null || a === '';
  const bNull = b == null || b === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  const aNum = typeof a === 'number' ? a : parseSortNumber(a);
  const bNum = typeof b === 'number' ? b : parseSortNumber(b);
  if (aNum != null && bNum != null) {
    const cmp = aNum - bNum;
    return ascending ? cmp : -cmp;
  }

  const cmp = String(a).localeCompare(String(b), undefined, {numeric: true, sensitivity: 'base'});
  return ascending ? cmp : -cmp;
}

export function sortRows(rows, sortConfig, getValue) {
  if (!sortConfig?.key || !Array.isArray(rows)) return rows;
  return [...rows].sort((a, b) => {
    if (a?._hdr || b?._hdr) return 0;
    const av = getValue(a, sortConfig.key);
    const bv = getValue(b, sortConfig.key);
    return compareSortValues(av, bv, sortConfig.ascending);
  });
}
