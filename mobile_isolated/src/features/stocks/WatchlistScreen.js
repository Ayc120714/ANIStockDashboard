import React, {useEffect} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {navigateToMainTab} from '@nav/navigationHelpers';
import {AYC} from '@core/theme/mobileStyles';

/** Legacy stack route — redirects into Stocks tab watchlist chips. */
export function WatchlistScreen({navigation, route}) {
  const listType = route.params?.listType === 'short_term' ? 'short_term' : 'long_term';

  useEffect(() => {
    navigateToMainTab(navigation, 'Stocks', {outlookTab: listType});
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [listType, navigation]);

  return (
    <MobileChrome navigation={navigation}>
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <ActivityIndicator color={AYC.accent} />
      </View>
    </MobileChrome>
  );
}
