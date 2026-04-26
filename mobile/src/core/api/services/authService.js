import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';

export const authService = {
  validateEmail: email => apiPost('/auth/validate-email', {email}),
  signup: payload => apiPost('/auth/signup', payload),
  loginStart: (email, password) => apiPost('/auth/login/start', {email, password}),
  loginWithEmailOtpStart: email => apiPost('/auth/login/email-otp/start', {email}),
  resendOtp: (flowId, purpose, channel) => apiPost('/auth/otp/send', {flow_id: flowId, purpose, channel}),
  verifyOtp: (flowId, purpose, channel, otpCode) =>
    apiPost('/auth/otp/verify', {flow_id: flowId, purpose, channel, otp_code: otpCode}),
  completeLogin: (flowId, trustDevice = false) =>
    apiPost('/auth/login/complete', {flow_id: flowId, trust_device: Boolean(trustDevice)}),
  completeEmailOtpLogin: (flowId, trustDevice = false) =>
    apiPost('/auth/login/email-otp/complete', {flow_id: flowId, trust_device: Boolean(trustDevice)}),
  completeSignup: (flowId, trustDevice = true) =>
    apiPost('/auth/signup/complete', {flow_id: flowId, trust_device: Boolean(trustDevice)}),
  refreshSession: refreshToken => apiPost('/auth/refresh', {refresh_token: refreshToken}),
  logoutSession: refreshToken => apiPost('/auth/logout', {refresh_token: refreshToken}),
  fetchMe: () => apiGet('/auth/me'),
  fetchAdminUsers: (includeInactive = true) =>
    apiGet(`/auth/admin/users?include_inactive=${String(includeInactive)}`),
  blockAdminUser: (userId, blocked = true) =>
    apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/block`, {blocked: Boolean(blocked)}),
  fetchPremiumEmails: () => apiGet('/auth/admin/premium-emails'),
  addPremiumEmail: email => apiPost('/auth/admin/premium-emails', {email: String(email || '').trim()}),
  deletePremiumEmail: entryId =>
    apiRequest(`/auth/admin/premium-emails/${encodeURIComponent(String(entryId))}`, {method: 'DELETE'}),
};
