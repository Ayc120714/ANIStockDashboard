const GATEWAY_STATUSES = new Set([502, 503, 504]);

/** Strip nginx/html error pages — never show raw markup in the UI. */
export function sanitizeApiErrorText(text, status) {
  const raw = String(text || '').trim();
  if (!raw) {
    return formatHttpStatusMessage(status);
  }

  const lower = raw.toLowerCase();
  if (lower.includes('<html') || lower.includes('<!doctype')) {
    if (lower.includes('502 bad gateway') || status === 502) {
      return 'Server is temporarily unavailable (502). The backend may be restarting — please retry in a few seconds.';
    }
    if (lower.includes('503 service unavailable') || status === 503) {
      return 'Server is busy (503). Please retry shortly.';
    }
    if (lower.includes('504 gateway timeout') || status === 504) {
      return 'Server took too long to respond (504). Please retry.';
    }
    return formatHttpStatusMessage(status);
  }

  if (lower === 'internal server error' || lower.includes('internal server error')) {
    return 'Server error. Please retry in a few seconds.';
  }
  if (lower === 'not found' || lower.includes('not found')) {
    return 'Broker service unavailable. Please update the app or retry shortly.';
  }
  if (raw.length > 240) {
    return `${raw.slice(0, 240)}…`;
  }
  return raw;
}

export function formatHttpStatusMessage(status) {
  const code = Number(status);
  if (code === 502) {
    return 'Server is temporarily unavailable (502). Please retry in a few seconds.';
  }
  if (code === 503) {
    return 'Server is busy (503). Please retry shortly.';
  }
  if (code === 504) {
    return 'Server took too long to respond (504). Please retry.';
  }
  if (code === 401) {
    return 'Your session expired. Please sign in again.';
  }
  if (code >= 500) {
    return `Server error (${code}). Please retry.`;
  }
  if (code >= 400) {
    return `Request failed (${code}).`;
  }
  return 'Request failed. Please retry.';
}

export function isRetryableGatewayStatus(status) {
  return GATEWAY_STATUSES.has(Number(status));
}
