import {StyleSheet} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';

export const INDEX_CARD_GAP = 8;

/** Compact mobile width for market index tiles (Dashboard + Markets). */
export function getIndexCardWidth(screenWidth) {
  return Math.min(112, Math.max(100, Math.round(screenWidth * 0.26)));
}

export function getIndexCardSnap(screenWidth) {
  return getIndexCardWidth(screenWidth) + INDEX_CARD_GAP;
}

export const indexCardStyles = StyleSheet.create({
  row: {flexDirection: 'row', gap: INDEX_CARD_GAP, paddingBottom: 2},
  card: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 8,
    minHeight: 64,
  },
  name: {fontSize: AYC.type.cardLabel, color: AYC.textMuted, fontWeight: '700'},
  price: {fontSize: AYC.type.metricSm, fontWeight: '800', color: AYC.text, marginTop: 2},
  pct: {fontSize: AYC.type.cardLabel, fontWeight: '700'},
  tag: {
    marginTop: 3,
    fontSize: 8,
    color: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '800',
  },
});
