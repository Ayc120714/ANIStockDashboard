/** Super-admin / admin allowlist defaults (must match backend AUTH_SUPER_ADMIN_EMAILS). */
export const DEFAULT_ADMIN_EMAILS = ['gvc1990@gmail.com'];

export function buildAdminEmailSet(...extraCsvLists) {
  const parts = [...DEFAULT_ADMIN_EMAILS];
  for (const csv of extraCsvLists) {
    String(csv || '')
      .split(',')
      .forEach((v) => parts.push(v));
  }
  return new Set(
    parts
      .map((v) => String(v).trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isConfiguredAdminEmail(email, adminSet = buildAdminEmailSet()) {
  return adminSet.has(String(email || '').trim().toLowerCase());
}
