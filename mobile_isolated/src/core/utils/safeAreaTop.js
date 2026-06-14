import {Platform, StatusBar} from 'react-native';

const ANDROID_MIN_TOP_INSET = 36;

/** Reliable top inset — SafeAreaContext can return 0 on some Android builds (cutout / RN 0.82). */
export function resolveTopInset(insets) {
  const reported = Number(insets?.top) || 0;
  const statusBar = Platform.OS === 'android' ? Number(StatusBar.currentHeight) || 0 : 0;
  if (Platform.OS === 'android') {
    return Math.max(reported, statusBar, ANDROID_MIN_TOP_INSET);
  }
  return reported;
}

export function resolveBottomInset(insets) {
  return Number(insets?.bottom) || 0;
}
