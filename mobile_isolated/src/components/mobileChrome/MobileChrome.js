import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@core/auth/AuthContext';
import {AYC} from '@core/theme/aycMobileTheme';
import {AppHeaderBar} from './AppHeaderBar';
import {HamburgerMenu} from './HamburgerMenu';
import {UserStrip} from './UserStrip';

/**
 * Shared shell: status padding + app bar + user strip (matches HTML mock chrome).
 * Wrap screen body as `children` (usually a ScrollView with flex:1).
 */
export function MobileChrome({navigation, children}) {
  const insets = useSafeAreaInsets();
  const {user} = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.root}>
      <View style={{paddingTop: insets.top, backgroundColor: AYC.appBar}}>
        <AppHeaderBar onMenuPress={() => setMenuOpen(true)} user={user} />
      </View>
      <UserStrip user={user} />
      <View style={styles.body}>{children}</View>
      <HamburgerMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navigation={navigation}
        user={user}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: AYC.pageBg},
  body: {flex: 1},
});
