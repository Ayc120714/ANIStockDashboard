import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

/** Sticky-style alerts above tab bar (entry-ready + admin registration nudges). */
export function AppShellBanner({
  entryHint,
  adminHint,
  onOpenSignals,
  onDismissEntry,
  onOpenAdmin,
  onDismissAdmin,
}) {
  if (!entryHint && !adminHint) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {adminHint ? (
        <View style={styles.rowAdmin}>
          <Pressable style={styles.entryFlex} onPress={onOpenAdmin}>
            <Text style={styles.adminText} numberOfLines={2}>
              {adminHint}
            </Text>
            <Text style={styles.adminCta}>Admin →</Text>
          </Pressable>
          {onDismissAdmin ? (
            <Pressable onPress={onDismissAdmin} hitSlop={12} accessibilityLabel="Dismiss">
              <Text style={styles.dismiss}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {entryHint ? (
        <View style={styles.rowEntry}>
          <Pressable style={styles.entryFlex} onPress={onOpenSignals}>
            <Text style={styles.entryText} numberOfLines={2}>
              {entryHint}
            </Text>
            <Text style={styles.entryCta}>Open →</Text>
          </Pressable>
          {onDismissEntry ? (
            <Pressable onPress={onDismissEntry} hitSlop={12} accessibilityLabel="Dismiss">
              <Text style={styles.dismiss}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fafafa',
  },
  rowEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ecfdf5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#a7f3d0',
    gap: 8,
  },
  rowAdmin: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#eff6ff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#bfdbfe',
    gap: 8,
  },
  adminText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  adminCta: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  entryFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  entryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#065f46',
  },
  entryCta: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  dismiss: {
    fontSize: 16,
    color: '#6b7280',
    paddingHorizontal: 4,
  },
});
