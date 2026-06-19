import React, {useEffect} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {navigateToMainTab} from '@nav/navigationHelpers';

/** Legacy Alerts stack route — web `/alerts` maps to the Signals tab. */
export function RedirectToSignalsTab({navigation}) {
  useEffect(() => {
    const rootNav = navigation.getParent?.() || navigation;
    navigateToMainTab(rootNav, 'Signals');
    const timer = setTimeout(() => {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6'}}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}
