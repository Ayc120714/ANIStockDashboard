import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';
import {mobilePad, mobileStyles} from '@core/theme/mobileStyles';

export const ScreenScaffold = ({title, subtitle, children}) => (
  <ScrollView style={styles.root} contentContainerStyle={[mobilePad, styles.container]}>
    <View style={styles.header}>
      <Text style={mobileStyles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={mobileStyles.subtitle}>{subtitle}</Text> : null}
    </View>
    <View style={styles.content}>{children}</View>
  </ScrollView>
);

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: AYC.pageBg},
  container: {gap: 10},
  header: {gap: 4, marginBottom: 2},
  content: {gap: 10},
});
