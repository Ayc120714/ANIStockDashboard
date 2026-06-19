import React, {useEffect} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {navigateToStocksOutlookTab} from '@nav/navigationHelpers';

/**
 * Legacy stack routes (Orders, Brokers) redirect into Stocks hub sub-tabs.
 */
export function RedirectToStocksTab({navigation, route, outlookTab}) {
  useEffect(() => {
    const params = route?.params || {};
    const extra =
      outlookTab === 'orders'
        ? {ordersParams: params}
        : outlookTab === 'brokers'
          ? {brokersParams: params}
          : {};
    const rootNav = navigation.getParent?.() || navigation;
    navigateToStocksOutlookTab(rootNav, outlookTab, extra);
    const timer = setTimeout(() => {
      if (navigation.canGoBack?.()) {
        navigation.goBack();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [navigation, outlookTab, route?.params]);

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6'}}>
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}
