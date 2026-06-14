import {extractApiRows} from '@core/utils/apiPayload';

/** Same broker session rules as web `loadBrokerHoldings.js`. */
export function brokerRowDrivesDashboardHoldings(row) {
  if (!row) return false;
  const b = String(row.broker || '').toLowerCase();
  if (b === 'dhan') return Boolean(row.has_session);
  return Boolean(row.live_enabled ?? row.has_session);
}

export function isAnyBrokerConnected(setupPayload) {
  return extractApiRows(setupPayload).some(brokerRowDrivesDashboardHoldings);
}
