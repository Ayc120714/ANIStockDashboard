/**
 * Premium access from backend ``/auth/me`` → ``outlook_premium`` (same flag for all of the below).
 *
 * - Long-horizon columns on Overview → Market / Sector insights (6M, 1Y, 3Y).
 * - Whole-app modules: Screens, Advisor, Portfolio Manager, Alerts, F&O, Commodities, Forex (route + sidebar).
 *
 * Backend: set ``OUTLOOK_PAYWALL_ACTIVE=true``, ``OUTLOOK_PREMIUM_LEGACY_CUTOFF_UTC`` (ISO) for grandfathering
 * older accounts. With the paywall on, new users get one month on first admin approval, then basic until renewed.
 * Admins can grant monthly (1 month IST) or yearly (1 year IST) paid terms, add emails to the premium allowlist,
 * set ``premium_complimentary`` or ``premium_lifetime``, or grandfather when ``created_at`` is before the cutoff
 * (backend ``outlook_premium_for_user``).
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
