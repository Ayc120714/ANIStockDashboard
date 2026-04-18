import {
  fetchSamcoBrokerHoldings,
  fetchSamcoBrokerOrders,
  fetchSamcoBrokerPositions,
} from './samcoBroker';
import {
  fetchUpstoxBrokerHoldings,
  fetchUpstoxBrokerOrders,
  fetchUpstoxBrokerPositions,
} from './upstoxBroker';
import {
  fetchKotakBrokerHoldings,
  fetchKotakBrokerOrders,
  fetchKotakBrokerPositions,
} from './kotakBroker';
import {
  fetchFyersBrokerHoldings,
  fetchFyersBrokerOrders,
  fetchFyersBrokerPositions,
} from './fyersBroker';
import {
  fetchZerodhaBrokerHoldings,
  fetchZerodhaBrokerOrders,
  fetchZerodhaBrokerPositions,
} from './zerodhaBroker';

/** Brokers whose live portfolio is loaded via `/…/positions|holdings|orders` (same response shape as Samco/Upstox). */
const SPECS = {
  samco: {
    positions: fetchSamcoBrokerPositions,
    holdings: fetchSamcoBrokerHoldings,
    orders: fetchSamcoBrokerOrders,
  },
  upstox: {
    positions: fetchUpstoxBrokerPositions,
    holdings: fetchUpstoxBrokerHoldings,
    orders: fetchUpstoxBrokerOrders,
  },
  kotak: {
    positions: fetchKotakBrokerPositions,
    holdings: fetchKotakBrokerHoldings,
    orders: fetchKotakBrokerOrders,
  },
  fyers: {
    positions: fetchFyersBrokerPositions,
    holdings: fetchFyersBrokerHoldings,
    orders: fetchFyersBrokerOrders,
  },
  zerodha: {
    positions: fetchZerodhaBrokerPositions,
    holdings: fetchZerodhaBrokerHoldings,
    orders: fetchZerodhaBrokerOrders,
  },
};

export const REST_BROKER_PORTFOLIO_KEYS = Object.keys(SPECS);

export const loadRestBrokerPortfolioSlices = (broker, userId) => {
  const spec = SPECS[String(broker || '').toLowerCase()];
  if (!spec) return null;
  return Promise.allSettled([
    spec.positions({ userId }),
    spec.holdings({ userId }),
    spec.orders({ userId }),
  ]);
};
