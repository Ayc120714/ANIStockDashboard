import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {sortIndicator} from '@core/utils/tableSort';

export function SortableTableHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
  style,
  textStyle,
  sortable = true,
}) {
  if (!sortable || !sortKey) {
    return <Text style={[styles.th, style, textStyle]}>{label}</Text>;
  }

  const active = sortConfig?.key === sortKey;
  return (
    <Pressable
      onPress={() => onSort(sortKey)}
      style={[styles.wrap, style]}
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${label}`}>
      <Text style={[styles.th, textStyle, active ? styles.thActive : null]}>
        {label}
        {sortIndicator(sortConfig, sortKey)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {justifyContent: 'center'},
  th: {color: '#fff', fontSize: 9, fontWeight: '800'},
  thActive: {color: '#bfdbfe'},
});
