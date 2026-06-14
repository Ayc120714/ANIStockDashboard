import {StyleSheet} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';

/** Shared page padding — Stitch `page-margin` / `section-gap` from design/stitch/DESIGN.md */
export const mobilePad = {
  padding: AYC.spacing.pageMargin,
  paddingBottom: 24,
  gap: AYC.spacing.sectionGap,
};

/** Dashboard-aligned typography and surface styles for all mobile screens. */
export const mobileStyles = StyleSheet.create({
  pageTitle: {fontSize: AYC.type.pageTitle, fontWeight: '800', color: AYC.text},
  sectionTitle: {
    fontSize: AYC.type.sectionTitle,
    fontWeight: '800',
    color: AYC.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  subtitle: {fontSize: AYC.type.body, color: AYC.textMuted, fontWeight: '600', lineHeight: 18},
  body: {fontSize: AYC.type.body, color: AYC.text, fontWeight: '600'},
  bodyBold: {fontSize: AYC.type.body, color: AYC.text, fontWeight: '800'},
  caption: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '700'},
  label: {fontSize: AYC.type.cardLabel, fontWeight: '700', color: AYC.textMuted},
  metricLg: {fontSize: AYC.type.metricLg, fontWeight: '800', color: AYC.text},
  metricMd: {fontSize: AYC.type.metricMd, fontWeight: '800', color: AYC.text},
  metricSm: {fontSize: AYC.type.metricSm, fontWeight: '800', color: AYC.text},
  muted: {fontSize: AYC.type.caption, color: AYC.textMuted},
  err: {fontSize: AYC.type.caption, color: AYC.negative, fontWeight: '700'},
  success: {fontSize: AYC.type.caption, color: AYC.positive, fontWeight: '700'},
  card: {
    backgroundColor: AYC.card,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  cardTitle: {fontSize: AYC.type.metricSm, fontWeight: '800', color: AYC.text},
  tableHead: {
    flexDirection: 'row',
    backgroundColor: AYC.appBar,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AYC.cardBorder,
    backgroundColor: AYC.card,
  },
  th: {color: '#fff', fontSize: AYC.type.cardLabel, fontWeight: '800'},
  td: {fontSize: AYC.type.caption, color: AYC.text, fontWeight: '700'},
  input: {
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: AYC.type.body,
    color: AYC.text,
    backgroundColor: AYC.card,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: AYC.card,
  },
  chipOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  chipText: {fontSize: AYC.type.caption, fontWeight: '700', color: AYC.textMuted},
  chipTextOn: {color: '#fff'},
  btnPrimary: {
    backgroundColor: AYC.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {color: '#fff', fontWeight: '800', fontSize: AYC.type.body},
  btnSecondary: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnSecondaryText: {color: AYC.text, fontWeight: '700', fontSize: AYC.type.body},
  btnOutline: {
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: AYC.card,
  },
  btnOutlineText: {color: AYC.text, fontWeight: '700', fontSize: AYC.type.body},
});

export {AYC};
