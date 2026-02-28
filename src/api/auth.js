import { apiGet, apiPost } from './apiClient';

export const validateEmail = (email) => apiPost('/auth/validate-email', { email });

export const signup = (payload) => apiPost('/auth/signup', payload);
export const forgotUserId = (mobile) => apiPost('/auth/forgot-id', { mobile });
export const forgotPasswordStart = (identifier) => apiPost('/auth/forgot-password/start', { identifier });
export const forgotPasswordComplete = (flowId, newPassword) =>
  apiPost('/auth/forgot-password/complete', { flow_id: flowId, new_password: newPassword });
export const adminPasswordlessLogin = (email) =>
  apiPost('/auth/admin/passwordless-login', { email });

export const loginStart = (email, password) =>
  apiPost('/auth/login/start', { email, password });

export const resendOtp = (flowId, purpose, channel) =>
  apiPost('/auth/otp/send', { flow_id: flowId, purpose, channel });

export const verifyOtp = (flowId, purpose, channel, otpCode) =>
  apiPost('/auth/otp/verify', {
    flow_id: flowId,
    purpose,
    channel,
    otp_code: otpCode,
  });

export const completeLogin = (flowId) =>
  apiPost('/auth/login/complete', { flow_id: flowId });

export const refreshSession = (refreshToken) =>
  apiPost('/auth/refresh', { refresh_token: refreshToken });

export const logoutSession = (refreshToken) =>
  apiPost('/auth/logout', { refresh_token: refreshToken });

export const fetchMe = () => apiGet('/auth/me');
