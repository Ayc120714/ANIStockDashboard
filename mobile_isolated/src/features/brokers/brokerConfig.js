export const BROKER_ORDER = ['dhan', 'samco', 'angelone', 'upstox', 'kotak', 'fyers', 'zerodha'];

export const BROKER_LABELS = {
  dhan: 'Dhan',
  samco: 'Samco (Trade API)',
  angelone: 'Angel One (SmartAPI)',
  upstox: 'Upstox',
  kotak: 'Kotak Neo',
  fyers: 'Fyers',
  zerodha: 'Zerodha (Kite)',
};

export const BROKER_DOCS = {
  dhan: 'https://dhanhq.co/docs/v2/',
  samco: 'https://docs-tradeapi.samco.in',
  angelone: 'https://smartapi.angelbroking.com/docs',
  upstox: 'https://upstox.com/developer/api-documentation',
  kotak: 'https://www.notion.so/Client-documentation-236da70d37e280b3a979fc7be7b003bc',
  fyers: 'https://myapi.fyers.in/docsv3',
  zerodha: 'https://kite.trade/docs/connect/v3/',
};

export const DHAN_DAILY_CONSENT_LIMIT = 25;

export const emptyCredentials = () => ({
  pin: '',
  totp: '',
  api_key: '',
  api_secret: '',
  token_id: '',
  access_token: '',
  auth_code: '',
  client_secret: '',
  redirect_uri: '',
});

export const BROKER_FIELD_HINTS = {
  dhan: 'OAuth uses numeric Client ID plus App ID and App Secret from Dhan → Access DhanHQ APIs.',
  samco: 'Samco uses server SAMCO_* env on backend. Optional fields below are for your records.',
  angelone: 'Use Published API key from SmartAPI console. Enter PIN and 6-digit TOTP to validate.',
  upstox: 'OAuth2 redirect flow: register app, set redirect URI, exchange auth code for tokens.',
  kotak: 'Enter Kotak Neo API credentials (consumer key, PIN, TOTP, or tokens).',
  fyers: 'Fyers API v3 OAuth2: app ID, secret, redirect URL, auth code, access token.',
  zerodha: 'Kite Connect: api_key, api_secret, redirect URL, request token from login redirect.',
};

export const BROKER_CREDENTIAL_FIELDS = {
  dhan: [
    {key: 'pin', label: 'PIN / Password', secret: true},
    {key: 'totp', label: 'TOTP'},
    {key: 'api_key', label: 'App ID (API Key)'},
    {key: 'api_secret', label: 'App Secret', secret: true},
    {key: 'token_id', label: 'tokenId (after Dhan redirect)'},
    {key: 'access_token', label: 'Access Token (JWT optional)'},
  ],
  samco: [
    {key: 'pin', label: 'PIN/Password (optional)', secret: true},
    {key: 'access_token', label: 'Access Token (optional)'},
  ],
  angelone: [
    {key: 'access_token', label: 'Access Token (optional)'},
    {key: 'api_key', label: 'API Key'},
    {key: 'pin', label: 'PIN/Password', secret: true},
    {key: 'totp', label: 'TOTP'},
  ],
  upstox: [
    {key: 'access_token', label: 'Access Token (optional)'},
    {key: 'auth_code', label: 'Auth Code'},
    {key: 'client_secret', label: 'Client Secret', secret: true},
    {key: 'redirect_uri', label: 'Redirect URI'},
  ],
  kotak: [
    {key: 'access_token', label: 'Access Token (optional)'},
    {key: 'api_key', label: 'API Key'},
    {key: 'pin', label: 'PIN', secret: true},
    {key: 'totp', label: 'TOTP'},
  ],
  fyers: [
    {key: 'api_key', label: 'App ID (API key)'},
    {key: 'api_secret', label: 'App Secret', secret: true},
    {key: 'redirect_uri', label: 'Redirect URI'},
    {key: 'auth_code', label: 'Auth code'},
    {key: 'access_token', label: 'Access token (optional)'},
  ],
  zerodha: [
    {key: 'api_key', label: 'API key (Kite app)'},
    {key: 'api_secret', label: 'API secret', secret: true},
    {key: 'redirect_uri', label: 'Redirect URL (registered on Kite)'},
    {key: 'auth_code', label: 'Request token / auth code'},
    {key: 'access_token', label: 'Access token (optional)'},
  ],
};

export function formatLastAuthIST(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  let ms = Date.parse(s);
  if (!Number.isFinite(ms)) return s;
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(ms));
  } catch (_) {
    return s;
  }
}

export function isLiveExecution(row) {
  return Boolean(row?.live_enabled || (row?.is_enabled && row?.has_session));
}

export function hasBrokerCredentials(row) {
  if (!row) return false;
  const broker = String(row.broker || '').toLowerCase();
  const clientId = String(row.client_id || '').trim();
  const cred = row.credentials || emptyCredentials();
  const pin = String(cred.pin || '').trim();
  const totp = String(cred.totp || '').trim();
  const accessToken = String(cred.access_token || '').trim();
  const apiKey = String(cred.api_key || '').trim();
  const apiSecret = String(cred.api_secret || '').trim();
  const authCode = String(cred.auth_code || '').trim();
  const clientSecret = String(cred.client_secret || '').trim();
  const redirectUri = String(cred.redirect_uri || '').trim();

  if (broker === 'dhan') {
    if (row.token_stored || row.has_session || row.last_auth_at) {
      return Boolean(clientId);
    }
    return Boolean(clientId && ((pin && totp) || accessToken || (apiKey && apiSecret)));
  }
  if (broker === 'samco') return true;
  if (broker === 'angelone' || broker === 'kotak') return Boolean(clientId && ((apiKey && pin && totp) || accessToken));
  if (broker === 'upstox') return Boolean(clientId && (accessToken || (authCode && clientSecret && redirectUri)));
  if (broker === 'fyers' || broker === 'zerodha') {
    return Boolean(apiKey && apiSecret && redirectUri && (accessToken || authCode));
  }
  return Boolean(clientId);
}

/** Pull credential hints saved on web / API (`credentials`, `webdata`, flat keys). */
export function extractWebBrokerCredentials(row) {
  const web = row?.webdata || row?.web_data || {};
  const cred = row?.credentials && typeof row.credentials === 'object' ? row.credentials : {};
  return {
    pin: String(cred.pin || web.pin || row.pin || '').trim(),
    totp: String(cred.totp || web.totp || row.totp || '').trim(),
    api_key: String(cred.api_key || web.api_key || row.api_key || row.session_api_key || '').trim(),
    api_secret: String(cred.api_secret || web.api_secret || row.api_secret || '').trim(),
    token_id: String(cred.token_id || web.token_id || row.token_id || '').trim(),
    access_token: String(cred.access_token || web.access_token || row.access_token || '').trim(),
    auth_code: String(cred.auth_code || web.auth_code || row.auth_code || '').trim(),
    client_secret: String(cred.client_secret || web.client_secret || row.client_secret || '').trim(),
    redirect_uri: String(cred.redirect_uri || web.redirect_uri || row.redirect_uri || '').trim(),
    mobile: String(cred.mobile || web.mobile || row.mobile || '').trim(),
  };
}

export function mergeBrokerRows(apiRows) {
  const byBroker = new Map((apiRows || []).map(r => [String(r.broker || '').toLowerCase(), r]));
  return BROKER_ORDER.map(broker => {
    const row = byBroker.get(broker);
    if (row) {
      const webCred = extractWebBrokerCredentials(row);
      return {
        ...row,
        broker,
        credentials: {...emptyCredentials(), ...webCred, ...(row.credentials || {})},
      };
    }
    return {
      broker,
      client_id: '',
      is_enabled: false,
      has_session: false,
      live_enabled: false,
      daily_session_ok: false,
      token_stored: false,
      credentials: emptyCredentials(),
    };
  });
}

export function positionLabel(row) {
  return (
    row?.tradingSymbol ||
    row?.symbol ||
    row?.securityId ||
    row?.tradingsymbol ||
    '—'
  );
}

export function orderLabel(row) {
  return row?.tradingSymbol || row?.symbol || row?.orderId || '—';
}
