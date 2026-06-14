import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

export function OptionPicker({visible, title, subtitle, options = [], selectedId, onSelect, onClose}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {options.map(opt => {
            const active = opt.id === selectedId;
            return (
              <Pressable
                key={opt.id}
                style={[styles.option, active ? styles.optionOn : null]}
                onPress={() => {
                  onSelect(opt.id);
                  onClose();
                }}>
                <Text style={[styles.optionLabel, active ? styles.optionLabelOn : null]}>{opt.label}</Text>
                {opt.hint ? <Text style={[styles.optionHint, active ? styles.optionHintOn : null]}>{opt.hint}</Text> : null}
              </Pressable>
            );
          })}
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
    maxHeight: '70%',
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
  optionOn: {backgroundColor: AYC.appBar, borderColor: AYC.appBar},
  optionLabel: {fontSize: AYC.type.body, fontWeight: '800', color: AYC.text},
  optionLabelOn: {color: '#fff'},
  optionHint: {fontSize: AYC.type.caption, color: AYC.textMuted, marginTop: 2},
  optionHintOn: {color: '#dbeafe'},
  cancelBtn: {alignItems: 'center', paddingVertical: 12},
  cancelText: {fontSize: AYC.type.body, fontWeight: '700', color: AYC.textMuted},
});
