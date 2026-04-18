/**
 * Premium access from backend ``/auth/me`` → ``outlook_premium`` (same flag for all of the below).
 *
 * - Long-horizon columns on Overview → Market / Sector insights (6M, 1Y, 3Y).
 * - Whole-app modules: Screens, Advisor, Portfolio Manager, Alerts, F&O, Commodities, Forex (route + sidebar).
 *
 * Backend: set ``OUTLOOK_PAYWALL_ACTIVE=true``, ``OUTLOOK_PREMIUM_LEGACY_CUTOFF_UTC`` (ISO) for grandfathering
 * older accounts. With the paywall on, new users stay basic until an admin records payment (Admin Users → Record
 * payment sets ``paid_premium_until`` to **one calendar year** later in **IST**, renewable yearly), adds the email
 * to the premium allowlist, ``premium_lifetime`` (permanent admin grant), ``premium_complimentary`` (revocable
 * admin grant without payment), or the account is grandfathered (``created_at`` before the cutoff).
 *
 * Frontend dev override: ``REACT_APP_OUTLOOK_PREMIUM_DEFAULT=false`` treats users as non-premium when
 * ``outlook_premium`` is absent (older cached user JSON). The app also re-fetches ``/auth/me`` periodically and when
 * the tab becomes visible so ``outlook_premium`` updates when paid premium expires (fallback to basic until payment).
 */
export const OUTLOOK_PREMIUM_COLUMN_KEYS = new Set(['month6m', 'year1y', 'year3y']);

export function resolveOutlookPremiumAccess(user) {
  // Strict entitlement gate: premium only when explicitly granted.
  if (!user || typeof user !== 'object') return false;
  if (user.is_super_admin === true) return true;
  return Boolean(
    user.premium_lifetime === true ||
      user.premium_complimentary === true ||
      user.paid_premium_active === true ||
      user.on_premium_allowlist === true,
  );
}
