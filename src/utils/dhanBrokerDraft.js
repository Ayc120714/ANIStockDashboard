/**
 * Dhan generate-consent / generateAccessToken expect the numeric Dhan Client ID (dhanClientId).
 * Legacy drafts may still store a duplicate ID in credentials.mobile; UI uses client_id only.
 */
export const sanitizeDhanClientId = (raw) =>
  String(raw ?? '')
    .replace(/\u200b/g, '')
    .replace(/\ufeff/g, '')
    .replace(/\s/g, '')
    .replace(/^\+/, '')
    .trim();

/** Strip to digits only (max 16) for the Client ID input and API payload — never send an email. */
export const dhanClientIdDigitsOnly = (raw) => {
  const s = sanitizeDhanClientId(raw);
  if (!s) return '';
  return s.replace(/\D/g, '').slice(0, 16);
};

/** Prefer numeric primary, else legacy alternate mobile field, when reading old saved rows/drafts. */
export const pickDhanClientIdForApi = (primaryRaw, alternateRaw) => {
  const top = sanitizeDhanClientId(primaryRaw);
  const alt = sanitizeDhanClientId(alternateRaw);
  const looksLikeNumericDhanId = (s) => /^\d{5,16}$/.test(s);
  if (looksLikeNumericDhanId(top)) return top;
  if (looksLikeNumericDhanId(alt)) return alt;
  return top || alt;
};

/** Value to send to /dhan/connect and related APIs: digits only, never email text. */
export const resolveDhanClientIdForSubmit = (primaryRaw, alternateRaw) =>
  dhanClientIdDigitsOnly(pickDhanClientIdForApi(primaryRaw, alternateRaw));

export const effectiveDhanClientIdFromDraft = (draft) => {
  if (!draft || typeof draft !== 'object') return '';
  const cred = draft.credentials && typeof draft.credentials === 'object' ? draft.credentials : {};
  return resolveDhanClientIdForSubmit(draft.client_id, cred.mobile);
};
