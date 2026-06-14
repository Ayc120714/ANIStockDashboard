import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';
import {tradeApiPost} from '@core/api/tradeApiClient';

export const ordersService = {
  placeOrder: payload => tradeApiPost('/orders/place', payload),
  fetchOrders: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', String(params.status));
    if (params.symbol) q.set('symbol', String(params.symbol));
    const s = q.toString();
    return apiGet(s ? `/orders?${s}` : '/orders');
  },
  fetchPortfolioPositions: () => apiGet('/orders/portfolio/positions'),
  cancelOrder: orderId => apiPost(`/orders/${encodeURIComponent(String(orderId))}/cancel`, {}),
  trailStopLossToCost: orderId => apiPost(`/orders/${encodeURIComponent(String(orderId))}/trail-sl-to-cost`, {}),
  updateOcoTarget: (orderId, targetPrice) =>
    apiPost(`/orders/${encodeURIComponent(String(orderId))}/oco-target-update`, {target_price: targetPrice}),
  deleteOrder: orderId => apiRequest(`/orders/${encodeURIComponent(String(orderId))}`, {method: 'DELETE'}),
  fetchExecutionMode: () => apiGet('/brokers/execution-mode'),
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
      apiGet(suffix ? `/orders/funds?${suffix}` : '/orders/funds'),
    );
  },
};
