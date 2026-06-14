import React from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {mobilePad, mobileStyles} from '@core/theme/mobileStyles';
import {StocksOverviewSection} from './StocksOverviewSection';

export function StocksHubScreen({navigation, route}) {
  const outlookTab = route?.params?.outlookTab;

  return (
    <MobileChrome navigation={navigation}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Stocks</Text>
        <Text style={styles.lead}>Overview, sector & sub-sector data load natively from the API — same datasets as the desk.</Text>
        <StocksOverviewSection navigation={navigation} initialTab={outlookTab} />
      </ScrollView>
    </MobileChrome>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  pad: mobilePad,
  screenTitle: mobileStyles.pageTitle,
  lead: mobileStyles.subtitle,
});
