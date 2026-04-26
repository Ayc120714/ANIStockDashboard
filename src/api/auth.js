import { apiGet, apiPost, apiRequest } from './apiClient';

export const validateEmail = (email) => apiPost('/auth/validate-email', { email });

export const signup = (payload) => apiPost('/auth/signup', payload);
export const forgotUserId = (mobile) => apiPost('/auth/forgot-id', { mobile });
export const forgotPasswordStart = (identifier) => apiPost('/auth/forgot-password/start', { identifier });
export const forgotPasswordComplete = (flowId, newPassword) =>
  apiPost('/auth/forgot-password/complete', { flow_id: flowId, new_password: newPassword });
export const loginStart = (email, password) =>
  apiPost('/auth/login/start', { email, password });

/** Passwordless login: email OTP only (no password step). */
export const loginWithEmailOtpStart = (email) =>
  apiPost('/auth/login/email-otp/start', { email });

export const resendOtp = (flowId, purpose, channel) =>
  apiPost('/auth/otp/send', { flow_id: flowId, purpose, channel });

export const verifyOtp = (flowId, purpose, channel, otpCode) =>
  apiPost('/auth/otp/verify', {
    flow_id: flowId,
    purpose,
    channel,
    otp_code: otpCode,
  });

export const completeLogin = (flowId, trustDevice = false) =>
  apiPost('/auth/login/complete', { flow_id: flowId, trust_device: Boolean(trustDevice) });

export const completeEmailOtpLogin = (flowId, trustDevice = false) =>
  apiPost('/auth/login/email-otp/complete', { flow_id: flowId, trust_device: Boolean(trustDevice) });

export const completeSignup = (flowId, trustDevice = true) =>
  apiPost('/auth/signup/complete', { flow_id: flowId, trust_device: Boolean(trustDevice) });

export const refreshSession = (refreshToken) =>
  apiPost('/auth/refresh', { refresh_token: refreshToken });

export const logoutSession = (refreshToken) =>
  apiPost('/auth/logout', { refresh_token: refreshToken });

export const fetchMe = () => apiGet('/auth/me');
export const updateMyMobile = (mobile) => apiPost('/auth/me/mobile', { mobile: String(mobile || '') });

export const fetchAdminUsers = (includeInactive = true) =>
  apiGet(`/auth/admin/users?include_inactive=${String(includeInactive)}`);

export const addAdminUser = (payload) =>
  apiPost('/auth/admin/users', payload);

export const deleteAdminUser = (userId) =>
  apiRequest(`/auth/admin/users/${encodeURIComponent(String(userId))}`, { method: 'DELETE' });

export const blockAdminUser = (userId, blocked = true) =>
  apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/block`, { blocked: Boolean(blocked) });

export const approveAdminUserAccessLink = (userId) =>
  apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/approve-access-link`, {});

export const rejectAdminUserRequest = (userId, reason = '') =>
  apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/reject`, { reason });

export const fetchPremiumEmails = () => apiGet('/auth/admin/premium-emails');

export const addPremiumEmail = (email) => apiPost('/auth/admin/premium-emails', { email: String(email || '').trim() });

export const deletePremiumEmail = (entryId) =>
  apiRequest(`/auth/admin/premium-emails/${encodeURIComponent(String(entryId))}`, { method: 'DELETE' });

/** After payment: server grants **one calendar year** in IST; renew with another call each year. */
export const setUserPaidPremium = (userId) =>
  apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/paid-premium`, {});

export const clearUserPaidPremium = (userId) =>
  apiRequest(`/auth/admin/users/${encodeURIComponent(String(userId))}/paid-premium`, { method: 'DELETE' });

/** Grant or revoke full premium without payment (super-admin only). */
export const setUserComplimentaryPremium = (userId, enabled) =>
  apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/premium-complimentary`, {
    enabled: Boolean(enabled),
  });

/** Permanent premium for a small set of users (super-admin only). */
export const setUserLifetimePremium = (userId, enabled) =>
  apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/premium-lifetime`, {
    enabled: Boolean(enabled),
  });

/** Bulk grant/revoke complimentary premium (single DB commit on server). Max 200 IDs. */
export const bulkSetUserComplimentaryPremium = (userIds, enabled = true) =>
  apiPost('/auth/admin/users/bulk-premium-complimentary', {
    user_ids: userIds.map((id) => Number(id)).filter((n) => n > 0),
    enabled: Boolean(enabled),
  });

/** Bulk grant/revoke lifetime premium (single DB commit on server). Max 200 IDs. */
export const bulkSetUserLifetimePremium = (userIds, enabled = true) =>
  apiPost('/auth/admin/users/bulk-premium-lifetime', {
    user_ids: userIds.map((id) => Number(id)).filter((n) => n > 0),
    enabled: Boolean(enabled),
  });

export const completeAccessLinkSetup = (flowId, token, newPassword, trustDevice = true) =>
  apiPost('/auth/access-link/complete', {
    flow_id: flowId,
    token,
    new_password: newPassword,
    trust_device: Boolean(trustDevice),
  });

export const fetchAiApiKeys = () => apiGet('/auth/ai-keys');

export const saveAiApiKey = (provider, apiKey, isActive = true) =>
  apiPost('/auth/ai-keys', {
    provider: String(provider || '').toLowerCase(),
    api_key: String(apiKey || ''),
    is_active: Boolean(isActive),
  });

export const setAiApiKeyStatus = (provider, isActive) =>
  apiPost(`/auth/ai-keys/${encodeURIComponent(String(provider || '').toLowerCase())}/status`, {
    is_active: Boolean(isActive),
  });

export const deleteAiApiKey = (provider) =>
  apiRequest(`/auth/ai-keys/${encodeURIComponent(String(provider || '').toLowerCase())}`, {
    method: 'DELETE',
  });
