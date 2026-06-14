import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {AYC} from '@core/theme/mobileStyles';

/**
 * Shared list pager — 10 rows per page with prev/next controls.
 */
export function ListPagePager({page, totalPages, onPageChange, totalItems, style}) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        style={[styles.btn, page <= 1 ? styles.btnDisabled : null]}
        disabled={page <= 1}
        onPress={() => onPageChange(Math.max(1, page - 1))}
        accessibilityRole="button"
        accessibilityLabel="Previous page">
        <Text style={styles.btnTxt}>‹</Text>
      </Pressable>
      <View style={styles.meta}>
        <Text style={styles.pageLbl}>
          {page} / {totalPages}
        </Text>
        {typeof totalItems === 'number' ? (
          <Text style={styles.countLbl}>{totalItems} stocks</Text>
        ) : null}
      </View>
      <Pressable
        style={[styles.btn, page >= totalPages ? styles.btnDisabled : null]}
        disabled={page >= totalPages}
        onPress={() => onPageChange(Math.min(totalPages, page + 1))}
        accessibilityRole="button"
        accessibilityLabel="Next page">
        <Text style={styles.btnTxt}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AYC.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AYC.card,
  },
  btnDisabled: {opacity: 0.35},
  btnTxt: {fontSize: 20, fontWeight: '800', color: AYC.accent, lineHeight: 22},
  meta: {alignItems: 'center', minWidth: 88},
  pageLbl: {fontSize: AYC.type.body, fontWeight: '800', color: AYC.text},
  countLbl: {fontSize: AYC.type.caption, color: AYC.textMuted, fontWeight: '600'},
});
