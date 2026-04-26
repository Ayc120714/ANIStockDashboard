import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

export const JsonCard = ({label, value}) => (
  <View style={styles.card}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{JSON.stringify(value, null, 2)}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 10, backgroundColor: '#fafafa'},
  label: {fontWeight: '700', marginBottom: 6},
  value: {fontFamily: 'monospace', fontSize: 12},
});
