import React from 'react';
import {Image, StyleSheet, View} from 'react-native';
import {AuthPageBackground} from '@components/auth/AuthPageBackground';

/** Native-style AYC brand splash — logo on navy blue, no loading copy. */
export function AycSplashScreen() {
  return (
    <AuthPageBackground>
      <View style={styles.center}>
        <Image
          source={require('../assets/ayc-logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="AYC Industries"
        />
      </View>
    </AuthPageBackground>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 280,
    height: 48,
  },
});
