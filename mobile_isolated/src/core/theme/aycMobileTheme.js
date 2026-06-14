import {STITCH_COLORS, STITCH_RADIUS, STITCH_SPACING} from './stitchDesignTokens';

/**
 * App theme — semantic aliases over Stitch Pro-Ledger tokens (`design/stitch/DESIGN.md`).
 * Keeps legacy `AYC.*` keys used across screens; values aligned with Stitch export.
 */
export const AYC = {
  appBar: STITCH_COLORS.primaryContainer,
  appBarMuted: STITCH_COLORS.onPrimaryContainer,
  appBarText: STITCH_COLORS.onPrimary,
  pageBg: STITCH_COLORS.background,
  card: STITCH_COLORS.surfaceCard,
  cardBorder: STITCH_COLORS.borderRegular,
  accent: STITCH_COLORS.secondary,
  accentSoft: STITCH_COLORS.secondaryFixed,
  text: STITCH_COLORS.onSurface,
  textMuted: STITCH_COLORS.onSurfaceVariant,
  positive: STITCH_COLORS.success,
  negative: STITCH_COLORS.danger,
  warning: STITCH_COLORS.warning,
  tabBarBg: STITCH_COLORS.surfaceContainerLowest,
  tabActive: STITCH_COLORS.primaryContainer,
  tabInactive: STITCH_COLORS.outlineVariant,
  userStripBg: STITCH_COLORS.surfaceContainerLow,
  planBadge: STITCH_COLORS.warning,
  planBadgeText: STITCH_COLORS.onSurface,
  shadow: 'rgba(24, 28, 32, 0.06)',
  /** Mobile-first type scale — readable on device; Stitch mockup uses denser table-data sizes. */
  type: {
    pageTitle: 18,
    sectionTitle: 11,
    cardLabel: 10,
    metricLg: 17,
    metricMd: 15,
    metricSm: 13,
    body: 13,
    caption: 11,
  },
  spacing: STITCH_SPACING,
  radius: STITCH_RADIUS,
  stitch: STITCH_COLORS,
};
