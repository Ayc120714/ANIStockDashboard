import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {AUTH_PAGE_BG} from '@core/theme/authTheme';

export function AuthPageBackground({children}) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={AUTH_PAGE_BG.edge} />
      <View style={styles.backdrop} pointerEvents="none">
        <View style={styles.blueGlow} />
        <View style={styles.midGlow} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH_PAGE_BG.edge,
    overflow: 'hidden',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  blueGlow: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    top: -130,
    left: -150,
    backgroundColor: AUTH_PAGE_BG.glow,
    opacity: 0.62,
  },
  midGlow: {
    position: 'absolute',
    width: 640,
    height: 640,
    borderRadius: 320,
    top: -60,
    left: -220,
    backgroundColor: AUTH_PAGE_BG.mid,
    opacity: 0.92,
  },
});
