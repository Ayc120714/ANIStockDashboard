import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';
import {tradeApiPost} from '@core/api/tradeApiClient';

export const ordersService = {
  placeOrder: payload => tradeApiPost('/orders/place', payload),
  fetchOrders: () => apiGet('/orders'),
  cancelOrder: orderId => apiPost(`/orders/${encodeURIComponent(String(orderId))}/cancel`, {}),
  trailStopLossToCost: orderId => apiPost(`/orders/${encodeURIComponent(String(orderId))}/trail-sl-to-cost`, {}),
  updateOcoTarget: (orderId, targetPrice) =>
    apiPost(`/orders/${encodeURIComponent(String(orderId))}/oco-target-update`, {target_price: targetPrice}),
  deleteOrder: orderId => apiRequest(`/orders/${encodeURIComponent(String(orderId))}`, {method: 'DELETE'}),
  fetchExecutionMode: () => apiGet('/brokers/execution-mode'),
  updateExecutionMode: mode => apiPost('/brokers/execution-mode', {mode}),
};
