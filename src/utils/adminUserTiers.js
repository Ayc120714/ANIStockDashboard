/** Tier classification for Admin user directory (web + shared logic). */

export function isMonthlyPremiumUser(row) {
  if (row?.premium_lifetime) return false;
  if (row?.paid_premium_active && row?.premium_plan === 'monthly') return true;
  return Boolean(row?.premium_complimentary || row?.on_premium_allowlist);
}

export function isYearlyPremiumUser(row) {
  if (row?.premium_lifetime) return false;
  if (!row?.paid_premium_active) return false;
  return row?.premium_plan === 'yearly' || !row?.premium_plan;
}

export function isBasicUser(row) {
  return !row?.premium_lifetime && !isMonthlyPremiumUser(row) && !isYearlyPremiumUser(row);
}

export function tierForUser(row) {
  if (!row) return 'basic';
  if (row.premium_lifetime) return 'lifetime';
  if (isMonthlyPremiumUser(row)) return 'monthly';
  if (isYearlyPremiumUser(row)) return 'yearly';
  return 'basic';
}

export function adminTierSectionId(tier) {
  return `admin-tier-${tier}`;
}
