import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AYC} from '@core/theme/aycMobileTheme';
import {mobilePad, mobileStyles} from '@core/theme/mobileStyles';
import {resolveTopInset} from '@core/utils/safeAreaTop';

export const ScreenScaffold = ({title, subtitle, children, withTopInset = false, scrollRef}) => {
  const insets = useSafeAreaInsets();
  const topPad = withTopInset ? resolveTopInset(insets) : 0;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.root}
      contentContainerStyle={[mobilePad, styles.container, topPad ? {paddingTop: topPad + 12} : null]}>
      {title ? (
        <View style={styles.header}>
          <Text style={mobileStyles.pageTitle}>{title}</Text>
          {subtitle ? <Text style={mobileStyles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: AYC.pageBg},
  container: {gap: 10},
  header: {gap: 4, marginBottom: 2},
  content: {gap: 10},
});
