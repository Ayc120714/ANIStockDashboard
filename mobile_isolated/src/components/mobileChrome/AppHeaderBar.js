import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';

function avatarInitial(user) {
  const n = (user?.name || user?.email || 'A').trim();
  return (n[0] || 'A').toUpperCase();
}

export function AppHeaderBar({
  onMenuPress,
  onNotificationsPress,
  notificationCount = 0,
  title = 'AYC INDUSTRIES',
  tagline = 'Analyze • Yield • Conquer',
  user,
}) {
  const initial = avatarInitial(user);
  const badgeLabel = notificationCount > 99 ? '99+' : String(notificationCount);
  return (
    <View style={styles.row}>
      <Pressable onPress={onMenuPress} style={styles.ham} accessibilityRole="button" accessibilityLabel="Open menu">
        <Text style={styles.hamIcon}>☰</Text>
      </Pressable>
      <View style={styles.brand}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.tag}>{tagline}</Text>
      </View>
      <Pressable
        onPress={onNotificationsPress}
        style={styles.bellBtn}
        accessibilityRole="button"
        accessibilityLabel="Open notifications"
      >
        <Text style={styles.bellIcon}>🔔</Text>
        {notificationCount > 0 ? (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </Pressable>
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
  brand: {flex: 1, minWidth: 0},
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
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  bellIcon: {fontSize: 17},
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  bellBadgeText: {color: '#fff', fontSize: 10, fontWeight: '800'},
});
