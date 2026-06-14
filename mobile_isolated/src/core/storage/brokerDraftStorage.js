import AsyncStorage from '@react-native-async-storage/async-storage';
import {emptyCredentials, extractWebBrokerCredentials, mergeBrokerRows} from '@features/brokers/brokerConfig';

export const sanitizeDhanClientId = raw =>
  String(raw ?? '')
    .replace(/\u200b/g, '')
    .replace(/\ufeff/g, '')
    .replace(/\s/g, '')
    .replace(/^\+/, '')
    .trim();

export const dhanClientIdDigitsOnly = raw => {
  const s = sanitizeDhanClientId(raw);
  if (!s) return '';
  return s.replace(/\D/g, '').slice(0, 16);
};

export const pickDhanClientIdForApi = (primaryRaw, alternateRaw) => {
  const top = sanitizeDhanClientId(primaryRaw);
  const alt = sanitizeDhanClientId(alternateRaw);
  const looksLikeNumericDhanId = s => /^\d{5,16}$/.test(s);
  if (looksLikeNumericDhanId(top)) return top;
  if (looksLikeNumericDhanId(alt)) return alt;
  return top || alt;
};

export const resolveDhanClientIdForSubmit = (primaryRaw, alternateRaw) =>
  dhanClientIdDigitsOnly(pickDhanClientIdForApi(primaryRaw, alternateRaw));

function draftKey(userId, broker) {
  return `broker_integration_draft_${userId}_${String(broker || '').toLowerCase()}`;
}

export function pendingDhanConnectKey(userId) {
  return `dhan_pending_connect_${userId}`;
}

export async function readBrokerDraft(userId, broker) {
  if (!userId || !broker) return {};
  try {
    const raw = await AsyncStorage.getItem(draftKey(userId, broker));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function persistBrokerDraftForRow(userId, row) {
  if (!userId || !row?.broker) return;
  const broker = String(row.broker).toLowerCase();
  if (!broker) return;
  const isDhan = broker === 'dhan';
  const draftClientId = isDhan
    ? resolveDhanClientIdForSubmit(row?.client_id, row?.credentials?.mobile)
    : String(row?.client_id || '').trim();
  try {
    await AsyncStorage.setItem(
      draftKey(userId, broker),
      JSON.stringify({
        client_id: draftClientId,
        credentials: {
          mobile: isDhan ? '' : String(row?.credentials?.mobile || '').trim(),
          pin: String(row?.credentials?.pin || '').trim(),
          totp: String(row?.credentials?.totp || '').trim(),
          api_key: String(row?.credentials?.api_key || '').trim(),
          api_secret: String(row?.credentials?.api_secret || '').trim(),
          redirect_uri: String(row?.credentials?.redirect_uri || '').trim(),
          auth_code: String(row?.credentials?.auth_code || '').trim(),
          client_secret: String(row?.credentials?.client_secret || '').trim(),
        },
      }),
    );
  } catch {
    /* ignore storage failures */
  }
}

export async function applyDraftToRow(row, userId) {
  const broker = String(row?.broker || '').toLowerCase();
  const draft = await readBrokerDraft(userId, broker);
  const draftCred = draft?.credentials && typeof draft.credentials === 'object' ? draft.credentials : {};
  const baseCred = {...emptyCredentials(), ...extractWebBrokerCredentials(row), ...(row?.credentials || {})};
  const mergedMobile = String(baseCred.mobile || draftCred.mobile || '').trim();
  const clientId =
    broker === 'dhan'
      ? resolveDhanClientIdForSubmit(
          row?.client_id || draft?.client_id,
          mergedMobile || draftCred.mobile || baseCred.mobile,
        )
      : String(row?.client_id || draft?.client_id || '').trim();

  return {
    ...row,
    client_id: clientId,
    credentials: {
      ...baseCred,
      mobile: broker === 'dhan' ? '' : mergedMobile,
      pin: String(baseCred.pin || draftCred.pin || '').trim(),
      totp: String(baseCred.totp || draftCred.totp || '').trim(),
      api_key: String(baseCred.api_key || draftCred.api_key || '').trim(),
      api_secret: String(baseCred.api_secret || draftCred.api_secret || '').trim(),
      redirect_uri: String(baseCred.redirect_uri || draftCred.redirect_uri || '').trim(),
      auth_code: String(baseCred.auth_code || draftCred.auth_code || '').trim(),
      client_secret: String(baseCred.client_secret || draftCred.client_secret || '').trim(),
    },
  };
}

export async function mergeBrokerRowsWithAccount(userId, apiRows) {
  const merged = mergeBrokerRows(apiRows);
  const out = [];
  for (const row of merged) {
    out.push(await applyDraftToRow(row, userId));
  }
  return out.map(row => ({
    ...row,
    is_enabled: Boolean(row.is_enabled || row.has_session || row.token_stored || row.client_id),
  }));
}
