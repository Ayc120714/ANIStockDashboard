import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

export const ScreenScaffold = ({title, subtitle, children}) => (
  <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    <View style={styles.content}>{children}</View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {padding: 16, gap: 12},
  title: {fontSize: 24, fontWeight: '700'},
  subtitle: {fontSize: 14, color: '#666'},
  content: {gap: 10},
});
