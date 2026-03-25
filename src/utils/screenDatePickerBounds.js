/**
 * Screen snapshot dates from API are YYYY-MM-DD strings (order may vary).
 * Parse as local calendar dates to avoid UTC off-by-one in the date picker.
 */
export function parseScreenDateString(s) {
  if (!s || typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Earliest / latest selectable dates for MUI DatePicker.
 * Keep minDate undefined so users can select older dates beyond currently snapshotted days.
 * Backend will resolve exact/nearest snapshot or live fallback for those dates.
 */
export function getScreenDatePickerBounds(availableDates) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return { minDate: undefined, maxDate: today };
}
