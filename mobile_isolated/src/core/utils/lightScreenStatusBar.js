import {useEffect} from 'react';
import {Platform, StatusBar} from 'react-native';

const MAIN_STATUS_BG = '#060b19';

/**
 * Use on full-screen light backgrounds (bootstrap, error) so system icons stay visible.
 * Restores the main app status bar style on unmount.
 */
export function useLightScreenStatusBar(backgroundColor = '#ffffff') {
  useEffect(() => {
    StatusBar.setBarStyle('dark-content', true);
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(backgroundColor, true);
    }
    return () => {
      StatusBar.setBarStyle('light-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(MAIN_STATUS_BG, true);
      }
    };
  }, [backgroundColor]);
}

export function LightScreenStatusBar({backgroundColor = '#ffffff'}) {
  useLightScreenStatusBar(backgroundColor);
  return (
    <StatusBar
      barStyle="dark-content"
      backgroundColor={backgroundColor}
      translucent={false}
    />
  );
}
