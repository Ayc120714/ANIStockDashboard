import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {tradeApiPost} from '@core/api/tradeApiClient';

const T = API_TIMEOUT_MS;

export const ordersService = {
  placeOrder: payload => tradeApiPost('/orders/place', payload),
  fetchOrders: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', String(params.status));
    if (params.symbol) q.set('symbol', String(params.symbol));
    const s = q.toString();
    return apiGet(s ? `/orders?${s}` : '/orders', {timeoutMs: params.timeoutMs ?? T.screen});
  },
  fetchPortfolioPositions: (opts = {}) =>
    apiGet('/orders/portfolio/positions', {timeoutMs: opts.timeoutMs ?? T.screen}),
  cancelOrder: orderId => apiPost(`/orders/${encodeURIComponent(String(orderId))}/cancel`, {}),
  trailStopLossToCost: orderId => apiPost(`/orders/${encodeURIComponent(String(orderId))}/trail-sl-to-cost`, {}),
  updateOcoTarget: (orderId, targetPrice) =>
    apiPost(`/orders/${encodeURIComponent(String(orderId))}/oco-target-update`, {target_price: targetPrice}),
  deleteOrder: orderId => apiRequest(`/orders/${encodeURIComponent(String(orderId))}`, {method: 'DELETE'}),
  fetchExecutionMode: (opts = {}) => apiGet('/brokers/execution-mode', {timeoutMs: opts.timeoutMs ?? T.default}),
  updateExecutionMode: mode => apiPost('/brokers/execution-mode', {mode}),
  fetchFundsPreview: params => {
    const q = new URLSearchParams();
    if (params?.broker) q.set('broker', String(params.broker));
    if (params?.product_type) q.set('product_type', String(params.product_type));
    if (params?.side) q.set('side', String(params.side));
    if (params?.qty != null) q.set('qty', String(params.qty));
    if (params?.price != null) q.set('price', String(params.price));
    const suffix = q.toString();
    return tradeApiPost('/orders/funds-preview', params).catch(() =>
      apiGet(suffix ? `/orders/funds?${suffix}` : '/orders/funds', {timeoutMs: T.screen}),
    );
  },
};
