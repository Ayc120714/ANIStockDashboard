import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@core/auth/AuthContext';
import {AYC} from '@core/theme/aycMobileTheme';
import {getActiveMainTabName, navigateFromMenu} from '@nav/navigationHelpers';

const DRAWER_FRAC = 0.78;

function avatarInitials(user) {
  const raw = (user?.name || user?.full_name || user?.email || 'A').trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (raw.slice(0, 2) || 'AY').toUpperCase();
}

function displayName(user) {
  const n = (user?.name || user?.full_name || '').trim();
  if (n) return n;
  return (user?.email || 'Member').trim();
}

function planBadgeText(user) {
  if (user?.is_super_admin) return 'LIFETIME';
  if (user?.is_admin) return 'ADMIN';
  return 'MEMBER';
}

function NavRow({icon, label, active, onPress, rightChevron, chevronDown}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.navRow, active && styles.navRowActive]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{selected: !!active}}
    >
      <Text style={[styles.navIcon, active && styles.navIconActive]}>{icon}</Text>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
      {rightChevron ? (
        <Text style={[styles.navChev, active && styles.navChevActive]}>{chevronDown ? '▼' : '▶'}</Text>
      ) : (
        <View style={styles.navChevSpacer} />
      )}
    </Pressable>
  );
}

function SubRow({label, onPress}) {
  return (
    <Pressable onPress={onPress} style={styles.subRow} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.subBullet}>•</Text>
      <Text style={styles.subLabel}>{label}</Text>
    </Pressable>
  );
}

export function HamburgerMenu({visible, onClose, navigation, user}) {
  const insets = useSafeAreaInsets();
  const {logout} = useAuth();
  const [stocksOpen, setStocksOpen] = useState(false);

  const drawerW = useMemo(() => {
    const w = Dimensions.get('window').width;
    return Math.min(w * DRAWER_FRAC, 360);
  }, []);

  const slide = useRef(new Animated.Value(-drawerW)).current;

  const activeTab = getActiveMainTabName(navigation);

  const closeAnimated = useCallback(
    after => {
      Animated.timing(slide, {
        toValue: -drawerW,
        duration: 220,
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) {
          onClose();
          if (typeof after === 'function') {
            setTimeout(after, 0);
          }
        }
      });
    },
    [drawerW, onClose, slide],
  );

  const go = useCallback(
    (screen, params) => {
      closeAnimated(() => navigateFromMenu(navigation, screen, params));
    },
    [closeAnimated, navigation],
  );

  useEffect(() => {
    if (!visible) {
      slide.setValue(-drawerW);
      setStocksOpen(false);
      return;
    }
    if (activeTab === 'Stocks') {
      setStocksOpen(true);
    }
    slide.setValue(-drawerW);
    Animated.timing(slide, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [activeTab, drawerW, slide, visible]);

  const onBackdropPress = useCallback(() => {
    closeAnimated();
  }, [closeAnimated]);

  const initials = avatarInitials(user);
  const name = displayName(user);
  const badge = planBadgeText(user);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={() => closeAnimated()}>
      <View style={styles.modalRoot}>
        <View style={styles.backdrop} pointerEvents="none" />
        <Pressable
          style={[styles.backdropTouch, {left: drawerW}]}
          onPress={onBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerW,
              paddingTop: insets.top + 12,
              paddingBottom: 12 + insets.bottom,
              transform: [{translateX: slide}],
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.brandBlock}>
              <Text style={styles.brandTitle}>AYC INDUSTRIES</Text>
              <Text style={styles.brandTag}>Analyze • Yield • Conquer</Text>
            </View>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          </View>

          <View style={styles.userRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{badge}</Text>
            </View>
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <NavRow
              icon="▣"
              label="Dashboard"
              active={activeTab === 'Dashboard'}
              onPress={() => go('Dashboard')}
            />
            <NavRow
              icon="📈"
              label="Stocks"
              active={activeTab === 'Stocks'}
              onPress={() => {
                go('Stocks');
                setStocksOpen(true);
              }}
              rightChevron
              chevronDown={stocksOpen}
            />
            {stocksOpen ? (
              <View style={styles.subWrap}>
                <SubRow label="Markets" onPress={() => go('Markets')} />
                <SubRow label="Sector insights" onPress={() => go('Stocks', {outlookTab: 'sector'})} />
                <SubRow label="SubSector" onPress={() => go('Stocks', {outlookTab: 'sub'})} />
                <SubRow label="Long-term watchlist" onPress={() => go('Stocks', {outlookTab: 'long_term'})} />
                <SubRow label="Short-term watchlist" onPress={() => go('Stocks', {outlookTab: 'short_term'})} />
                <SubRow label="Mutual funds" onPress={() => go('MutualFunds')} />
                <SubRow label="Signals" onPress={() => go('Signals')} />
                <SubRow label="Orders" onPress={() => go('Stocks', {outlookTab: 'orders'})} />
                <SubRow label="Brokers" onPress={() => go('Stocks', {outlookTab: 'brokers'})} />
                <SubRow label="Alerts" onPress={() => go('Stocks', {outlookTab: 'alerts'})} />
              </View>
            ) : null}

            <NavRow icon="▤" label="Screens" active={activeTab === 'Screens'} onPress={() => go('Screens')} />
            <NavRow icon="✦" label="Advisor" active={activeTab === 'Advisor'} onPress={() => go('Advisor')} />
            <NavRow icon="👛" label="Portfolio Manager" onPress={() => go('Portfolio')} />
            <NavRow icon="🔔" label="Alerts" onPress={() => go('Stocks', {outlookTab: 'alerts'})} />

            <View style={styles.divider} />

            <NavRow icon="❓" label="Help & Support" onPress={() => go('Stocks', {outlookTab: 'alerts'})} />
            <Pressable
              onPress={() => {
                logout();
                onClose();
              }}
              style={styles.logoutRow}
              accessibilityRole="button"
              accessibilityLabel="Logout"
            >
              <Text style={styles.logoutIcon}>⎋</Text>
              <Text style={styles.logoutLabel}>Logout</Text>
            </Pressable>
            {user?.is_super_admin ? (
              <Pressable onPress={() => go('Admin')} style={styles.adminHint}>
                <Text style={styles.adminHintText}>Admin</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 2,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: {width: 4, height: 0},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: AYC.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  brandBlock: {flex: 1, paddingRight: 8},
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AYC.accent,
    letterSpacing: 0.6,
  },
  brandTag: {
    fontSize: 11,
    marginTop: 4,
    color: AYC.accent,
    fontWeight: '600',
    opacity: 0.9,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: AYC.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  avatarInitials: {fontSize: 15, fontWeight: '800', color: AYC.accent},
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  userName: {fontSize: 15, fontWeight: '600', color: AYC.text, flexShrink: 1},
  planBadge: {
    borderWidth: 1,
    borderColor: AYC.accent,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  planBadgeText: {fontSize: 11, fontWeight: '800', color: AYC.accent},
  scroll: {flex: 1},
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: 10,
    gap: 10,
  },
  navRowActive: {
    backgroundColor: AYC.accentSoft,
  },
  navIcon: {fontSize: 18, width: 28, textAlign: 'center', color: AYC.text},
  navIconActive: {color: AYC.accent},
  navLabel: {flex: 1, fontSize: 15, fontWeight: '600', color: AYC.text},
  navLabelActive: {color: AYC.accent},
  navChev: {fontSize: 12, color: AYC.textMuted, width: 20, textAlign: 'right'},
  navChevActive: {color: AYC.accent},
  navChevSpacer: {width: 20},
  subWrap: {
    paddingLeft: 36,
    paddingRight: 12,
    paddingBottom: 4,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  subBullet: {color: AYC.textMuted, fontSize: 14},
  subLabel: {fontSize: 14, fontWeight: '600', color: AYC.textMuted},
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AYC.cardBorder,
    marginVertical: 12,
    marginHorizontal: 16,
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    marginTop: 4,
    gap: 10,
  },
  logoutIcon: {fontSize: 18, width: 28, textAlign: 'center', color: AYC.negative},
  logoutLabel: {fontSize: 15, fontWeight: '700', color: AYC.negative},
  adminHint: {paddingHorizontal: 24, paddingVertical: 8},
  adminHintText: {fontSize: 13, fontWeight: '700', color: AYC.accent},
});
