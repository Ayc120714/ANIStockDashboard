import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@core/auth/AuthContext';
import {AYC} from '@core/theme/aycMobileTheme';
import {resolveTopInset} from '@core/utils/safeAreaTop';
import {useNotificationInbox} from '@hooks/useNotificationInbox';
import {AppHeaderBar} from './AppHeaderBar';
import {HamburgerMenu} from './HamburgerMenu';
import {NotificationInboxModal} from './NotificationInboxModal';
import {UserStrip} from './UserStrip';

/**
 * Shared shell: status padding + app bar + user strip (matches HTML mock chrome).
 * Wrap screen body as `children` (usually a ScrollView with flex:1).
 */
export function MobileChrome({navigation, children}) {
  const insets = useSafeAreaInsets();
  const topInset = resolveTopInset(insets);
  const {user, isAuthenticated} = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const userId = String(user?.id || user?.user_id || '');
  const isSuperAdmin = Boolean(user?.is_super_admin);

  const {sections, counts, loading, error, badgeCount, load, markItemRead, markAllRead} = useNotificationInbox({
    enabled: isAuthenticated,
    userId,
    isSuperAdmin,
  });

  const openInbox = () => {
    setInboxOpen(true);
    load({background: true});
  };

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <View style={[styles.statusPad, {height: topInset}]} />
      <View style={styles.header}>
        <AppHeaderBar
          onMenuPress={() => setMenuOpen(true)}
          onNotificationsPress={openInbox}
          notificationCount={badgeCount}
          user={user}
        />
      </View>
      <UserStrip user={user} />
      <View style={styles.body}>{children}</View>
      <HamburgerMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        user={user}
      />
      <NotificationInboxModal
        visible={inboxOpen}
        onClose={() => setInboxOpen(false)}
        navigation={navigation}
        isSuperAdmin={isSuperAdmin}
        sections={sections}
        counts={counts}
        loading={loading}
        error={error}
        onRefresh={() => {
          load({background: false});
        }}
        onMarkItemRead={markItemRead}
        onMarkAllRead={markAllRead}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: AYC.pageBg},
  statusPad: {backgroundColor: AYC.appBar},
  header: {backgroundColor: AYC.appBar},
  body: {flex: 1},
});
