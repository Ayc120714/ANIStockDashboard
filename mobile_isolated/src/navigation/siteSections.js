/**
 * Paths aligned with stockdashboard/src/routes/AppRouter.js.
 * Opens in WebPortalScreen so mobile users can access the same web modules.
 */
export const SITE_SECTIONS = [
  {title: 'Dashboard', path: '/'},
  {title: 'Long term', path: '/long-term'},
  {title: 'Short term', path: '/short-term'},
  {title: 'Outlook', path: '/outlook'},
  {title: 'Screens', path: '/screens'},
  {title: 'Advisor', path: '/advisor'},
  {title: 'Video screener', path: '/video-screener'},
  {title: 'Portfolio manager', path: '/portfolio-manager'},
  {title: 'Stock alerts', path: '/alerts'},
  {title: 'Mutual funds', path: '/mutual-funds'},
  {title: 'Profile', path: '/profile'},
  {title: 'Upgrade premium', path: '/upgrade-premium'},
  {title: 'Events', path: '/events'},
  {title: 'Onboarding', path: '/onboarding'},
  {title: 'F&O', path: '/fno'},
  {title: 'Commodities', path: '/commodities'},
  {title: 'Forex', path: '/forex'},
  {title: 'Dhan callback', path: '/dhan-callback'},
  {title: 'Access link setup', path: '/access-link-setup'},
  {title: 'Pricing', path: '/pricing'},
  {title: 'Privacy policy', path: '/privacy-policy'},
  {title: 'Terms of use', path: '/terms-of-use'},
  {title: 'Cancellation policy', path: '/cancellation-policy'},
];

/** Shown only when `user.is_super_admin` (same as web `AdminRoute` / super-admin APIs). */
export const SITE_SECTIONS_ADMIN = [
  {title: 'Telegram admin', path: '/telegram-admin'},
  {title: 'Admin users', path: '/admin-users'},
];
