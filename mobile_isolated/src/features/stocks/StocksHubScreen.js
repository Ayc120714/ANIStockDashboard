import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {navigateToAlerts} from '@nav/navigationHelpers';
import {mobilePad, mobileStyles} from '@core/theme/mobileStyles';
import {StocksOverviewSection} from './StocksOverviewSection';

export function StocksHubScreen({navigation, route}) {
  const outlookTab = route?.params?.outlookTab;
  const ordersParams = route?.params?.ordersParams;
  const brokersParams = route?.params?.brokersParams;

  useEffect(() => {
    if (outlookTab === 'alerts') {
      navigateToAlerts(navigation);
    }
  }, [navigation, outlookTab]);

  return (
    <MobileChrome navigation={navigation}>
      <View style={styles.container}>
        <Text style={styles.screenTitle}>Stocks</Text>
        <StocksOverviewSection
          navigation={navigation}
          initialTab={outlookTab}
          ordersParams={ordersParams}
          brokersParams={brokersParams}
        />
      </View>
    </MobileChrome>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, ...mobilePad},
  screenTitle: mobileStyles.pageTitle,
});
