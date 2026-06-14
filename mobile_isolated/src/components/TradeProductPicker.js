import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';
import {TRADE_PRODUCT_OPTIONS} from '@core/utils/tradePreflight';

export function TradeProductPicker({visible, symbol, onSelect, onClose}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Trade setup</Text>
          <Text style={styles.subtitle}>
            {symbol ? `${String(symbol).toUpperCase()} · choose product type` : 'Choose product type'}
          </Text>
          {TRADE_PRODUCT_OPTIONS.map(opt => (
            <Pressable
              key={opt.value}
              style={styles.option}
              onPress={() => {
                onSelect(opt.value);
                onClose();
              }}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionHint}>
                {opt.value === 'INTRADAY'
                  ? 'Square-off same day (MIS)'
                  : opt.value === 'MARGIN'
                    ? 'MTF / margin product'
                    : 'Delivery (CNC)'}
              </Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: AYC.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 10,
  },
  title: mobileStyles.pageTitle,
  subtitle: mobileStyles.caption,
  option: {
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 12,
    padding: 12,
    backgroundColor: AYC.pageBg,
  },
  optionLabel: {fontSize: AYC.type.body, fontWeight: '800', color: AYC.text},
  optionHint: {fontSize: AYC.type.caption, color: AYC.textMuted, marginTop: 2},
  cancelBtn: {alignItems: 'center', paddingVertical: 12},
  cancelText: {fontSize: AYC.type.body, fontWeight: '700', color: AYC.textMuted},
});
