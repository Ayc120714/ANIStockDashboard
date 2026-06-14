import {apiGet, apiPost, apiRequest} from '@core/api/apiClient';
import {env} from '@core/config/env';

/** Backend returns `{ ok, user }`; callers expect the user record. */
const normalizeMePayload = payload => {
  if (payload && typeof payload === 'object' && payload.user != null && typeof payload.user === 'object') {
    return payload.user;
  }
  return payload;
};

const LOCAL_FLOW_PREFIX = 'local-flow-';
const localSession = {
  user: null,
};

const buildLocalUser = email => ({
  id: 999001,
  email: String(email || 'local.user@aycindustries.com').trim().toLowerCase(),
  full_name: 'Local Test User',
  name: 'Local Test User',
  is_active: true,
  is_admin: false,
  is_super_admin: false,
});

export const authService = {
  validateEmail: email => apiPost('/auth/validate-email', {email}),
  signup: payload => apiPost('/auth/signup', payload),
  loginStart: async (email, password) => {
    if (!env.localAuthMode) {
      return apiPost('/auth/login/start', {email, password});
    }
    localSession.user = buildLocalUser(email);
    return {flow_id: `${LOCAL_FLOW_PREFIX}${Date.now()}`};
  },
  loginWithEmailOtpStart: async email => {
    if (!env.localAuthMode) {
      return apiPost('/auth/login/email-otp/start', {email});
    }
    localSession.user = buildLocalUser(email);
    return {flow_id: `${LOCAL_FLOW_PREFIX}${Date.now()}`};
  },
  resendOtp: (flowId, purpose, channel) => apiPost('/auth/otp/send', {flow_id: flowId, purpose, channel}),
  verifyOtp: async (flowId, purpose, channel, otpCode) => {
    if (!env.localAuthMode) {
      return apiPost('/auth/otp/verify', {flow_id: flowId, purpose, channel, otp_code: otpCode});
    }
    return {ok: true, flow_id: flowId, local_mode: true};
  },
  completeLogin: async (flowId, trustDevice = false) => {
    if (!env.localAuthMode) {
      return apiPost('/auth/login/complete', {flow_id: flowId, trust_device: Boolean(trustDevice)});
    }
    return {
      access_token: `local-access-${Date.now()}`,
      refresh_token: `local-refresh-${Date.now()}`,
      token_type: 'bearer',
    };
  },
  completeEmailOtpLogin: async (flowId, trustDevice = false) => {
    if (!env.localAuthMode) {
      return apiPost('/auth/login/email-otp/complete', {flow_id: flowId, trust_device: Boolean(trustDevice)});
    }
    return {
      access_token: `local-access-${Date.now()}`,
      refresh_token: `local-refresh-${Date.now()}`,
      token_type: 'bearer',
    };
  },
  completeSignup: (flowId, trustDevice = true) =>
    apiPost('/auth/signup/complete', {flow_id: flowId, trust_device: Boolean(trustDevice)}),
  refreshSession: async refreshToken => {
    if (!env.localAuthMode) {
      return apiPost('/auth/refresh', {refresh_token: refreshToken});
    }
    return {
      access_token: `local-access-${Date.now()}`,
      refresh_token: refreshToken || `local-refresh-${Date.now()}`,
      token_type: 'bearer',
    };
  },
  logoutSession: async refreshToken => {
    if (!env.localAuthMode) {
      return apiPost('/auth/logout', {refresh_token: refreshToken});
    }
    localSession.user = null;
    return {ok: true, local_mode: true};
  },
  fetchMe: async (opts = {}) => {
    if (!env.localAuthMode) {
      return normalizeMePayload(await apiGet('/auth/me', opts));
    }
    return localSession.user || buildLocalUser('local.user@aycindustries.com');
  },
  fetchAdminUsers: (includeInactive = true) =>
    apiGet(`/auth/admin/users?include_inactive=${String(includeInactive)}`),
  blockAdminUser: (userId, blocked = true) =>
    apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/block`, {blocked: Boolean(blocked)}),
  approveAdminUserAccessLink: userId =>
    apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/approve-access-link`, {}),
  rejectAdminUserRequest: (userId, reason = '') =>
    apiPost(`/auth/admin/users/${encodeURIComponent(String(userId))}/reject`, {reason: String(reason || '')}),
  deleteAdminUser: userId =>
    apiRequest(`/auth/admin/users/${encodeURIComponent(String(userId))}`, {method: 'DELETE'}),
  fetchPremiumEmails: () => apiGet('/auth/admin/premium-emails'),
  addPremiumEmail: email => apiPost('/auth/admin/premium-emails', {email: String(email || '').trim()}),
  deletePremiumEmail: entryId =>
    apiRequest(`/auth/admin/premium-emails/${encodeURIComponent(String(entryId))}`, {method: 'DELETE'}),
};
