import { apiGet, apiPost, apiRequest } from './apiClient';

export const fetchTelegramSubscribers = async ({ activeOnly = true, approvedOnly = false } = {}) => {
  const params = new URLSearchParams();
  params.set('active_only', String(activeOnly));
  params.set('approved_only', String(approvedOnly));
  const data = await apiGet(`/telegram/subscribers?${params.toString()}`);
  return data?.data ?? [];
};

export const setTelegramSubscriberApproval = async (chatId, isApproved) => {
  return apiPost('/telegram/approve', {
    chat_id: String(chatId),
    is_approved: Boolean(isApproved),
  });
};

export const deleteTelegramSubscriber = async (chatId) => {
  const id = encodeURIComponent(String(chatId));
  try {
    return await apiRequest(`/telegram/subscribers/${id}`, {
      method: 'DELETE',
    });
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    const shouldFallback = msg.includes('not found') || msg.includes('404') || msg.includes('405');
    if (!shouldFallback) {
      throw err;
    }
    return apiPost('/telegram/delete', { chat_id: String(chatId) });
  }
};
