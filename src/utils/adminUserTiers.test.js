import {
  formatAdminUserAccessHints,
  isBasicUser,
  isMonthlyPremiumUser,
  isYearlyPremiumUser,
  tierForUser,
  adminTierSectionId,
} from './adminUserTiers';

describe('adminUserTiers', () => {
  it('places lifetime users in lifetime tier', () => {
    const row = { id: 1, premium_lifetime: true, paid_premium_active: true, premium_plan: 'yearly' };
    expect(tierForUser(row)).toBe('lifetime');
    expect(isBasicUser(row)).toBe(false);
  });

  it('places complimentary allowlist users in monthly tier', () => {
    const row = { id: 2, premium_complimentary: true };
    expect(tierForUser(row)).toBe('monthly');
    expect(isMonthlyPremiumUser(row)).toBe(true);
  });

  it('places active yearly paid users in yearly tier', () => {
    const row = { id: 3, paid_premium_active: true, premium_plan: 'yearly' };
    expect(tierForUser(row)).toBe('yearly');
    expect(isYearlyPremiumUser(row)).toBe(true);
  });

  it('places users with no premium flags in basic tier', () => {
    const row = { id: 4 };
    expect(tierForUser(row)).toBe('basic');
    expect(isBasicUser(row)).toBe(true);
  });

  it('maps tier keys to scroll section element ids', () => {
    expect(adminTierSectionId('monthly')).toBe('admin-tier-monthly');
  });

  it('access hints hide paid monthly/yearly when user has lifetime premium', () => {
    expect(
      formatAdminUserAccessHints({
        premium_lifetime: true,
        paid_premium_active: true,
        premium_plan: 'monthly',
      }),
    ).toBe('Life.');
    expect(
      formatAdminUserAccessHints({
        paid_premium_active: true,
        premium_plan: 'monthly',
      }),
    ).toBe('Monthly');
  });
});
