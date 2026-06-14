/** Super-admin only — matches web AdminRoute and /auth/admin/* APIs. */
export function isAppAdmin(user) {
  return Boolean(user?.is_super_admin);
}
