import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';

function planLabel(user) {
  const p = String(user?.subscription_tier || user?.plan || '').toUpperCase();
  if (p) return p;
  if (user?.is_super_admin) return 'ADMIN';
  return 'MEMBER';
}

function displayName(user) {
  const direct = user?.name || user?.full_name || user?.first_name || user?.display_name || user?.username;
  if (direct && String(direct).trim()) {
    return String(direct).trim();
  }
  const email = String(user?.email || '').trim();
  if (!email) {
    return 'Member';
  }
  const local = email.split('@')[0] || '';
  if (!local) {
    return 'Member';
  }
  return local
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export function UserStrip({user}) {
  const name = displayName(user);
  return (
    <View style={styles.wrap}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{planLabel(user)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: AYC.userStripBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AYC.cardBorder,
  },
  name: {flex: 1, fontSize: 14, fontWeight: '700', color: AYC.text},
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: AYC.planBadge,
  },
  badgeText: {fontSize: 10, fontWeight: '900', color: AYC.planBadgeText, letterSpacing: 0.6},
});
