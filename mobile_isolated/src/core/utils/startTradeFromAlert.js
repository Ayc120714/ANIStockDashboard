import {Alert} from 'react-native';
import {brokersService} from '@core/api/services/brokersService';
import {extractApiRows} from '@core/utils/apiPayload';
import {
  brokerRowHasLiveTradingSession,
  buildOrdersRouteFromAlert,
  pickConnectedBrokerRow,
} from '@core/utils/tradePreflight';
import {navigateToStocksBrokers, navigateToStocksOrders} from '@nav/navigationHelpers';

export async function startTradeFromAlert(navigation, alert, {productType, side, userId} = {}) {
  if (!navigation || !alert) return;

  const orderParams = buildOrdersRouteFromAlert(alert, {productType, side});

  let connected = null;
  try {
    const setup = await brokersService.fetchBrokerSetup({userId});
    const rows = extractApiRows(setup, ['data']);
    connected = pickConnectedBrokerRow(rows.length ? rows : setup, 'dhan');
  } catch (_) {
    connected = null;
  }

  if (connected?.broker) {
    orderParams.broker = String(connected.broker).toLowerCase();
    navigateToStocksOrders(navigation, orderParams);
    return;
  }

  Alert.alert(
    'Broker session required',
    'Validate your broker session before placing a live order from this alert.',
    [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Validate broker',
        onPress: () =>
          navigateToStocksBrokers(navigation, {
            returnTo: 'orders',
            returnParams: orderParams,
            openBrokerSetup: true,
            selectedBroker: 'dhan',
          }),
      },
    ],
  );
}

export function brokerSessionSummary(row) {
  if (!row) {
    return {ok: false, label: 'No broker connected', detail: 'Connect and validate a broker session first.'};
  }
  const broker = String(row.broker || 'broker').toUpperCase();
  if (brokerRowHasLiveTradingSession(row)) {
    return {
      ok: true,
      label: `${broker} session active`,
      detail: row.last_auth_at ? `Last auth: ${String(row.last_auth_at).slice(0, 19)}` : 'Session is live.',
    };
  }
  return {
    ok: false,
    label: `${broker} session inactive`,
    detail: 'Tap Validate & Create Session on the Brokers screen.',
  };
}
