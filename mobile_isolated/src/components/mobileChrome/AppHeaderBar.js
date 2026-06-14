import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';

function avatarInitial(user) {
  const n = (user?.name || user?.email || 'A').trim();
  return (n[0] || 'A').toUpperCase();
}

export function AppHeaderBar({
  onMenuPress,
  title = 'AYC INDUSTRIES',
  tagline = 'Analyze • Yield • Conquer',
  user,
}) {
  const initial = avatarInitial(user);
  return (
    <View style={styles.row}>
      <Pressable onPress={onMenuPress} style={styles.ham} accessibilityRole="button" accessibilityLabel="Open menu">
        <Text style={styles.hamIcon}>☰</Text>
      </Pressable>
      <View style={styles.brand}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.tag}>{tagline}</Text>
      </View>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AYC.appBar,
    gap: 10,
  },
  ham: {padding: 6, minWidth: 40},
  hamIcon: {color: AYC.appBarText, fontSize: 22, fontWeight: '600'},
  brand: {flex: 1},
  title: {color: AYC.appBarText, fontSize: 15, fontWeight: '800', letterSpacing: 0.5},
  tag: {color: AYC.appBarMuted, fontSize: 11, marginTop: 2},
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  avatarText: {color: AYC.appBarText, fontWeight: '800', fontSize: 14},
});
