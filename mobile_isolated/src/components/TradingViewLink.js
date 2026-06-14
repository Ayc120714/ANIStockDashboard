import React from 'react';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';

export function tradingViewChartUrl(symbol) {
  const s = String(symbol || '').trim();
  if (!s) return '';
  return `https://www.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(s)}`;
}

/** Same NSE chart link as web `TradingViewLink` (Financial Advisor tables). */
export function TradingViewLink({symbol, size = 18}) {
  const s = String(symbol || '').trim();
  if (!s) return null;

  const openChart = () => {
    const url = tradingViewChartUrl(s);
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <Pressable
      onPress={openChart}
      accessibilityRole="link"
      accessibilityLabel={`View ${s} on TradingView`}
      hitSlop={6}
      style={[styles.wrap, {width: size, height: size, borderRadius: size / 2}]}>
      <View style={styles.bars}>
        <View style={[styles.bar, styles.barSm]} />
        <View style={[styles.bar, styles.barMd]} />
        <View style={[styles.bar, styles.barLg]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#131722',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    height: 8,
  },
  bar: {
    width: 2,
    backgroundColor: '#2962FF',
    borderRadius: 0.5,
  },
  barSm: {height: 4},
  barMd: {height: 6},
  barLg: {height: 8},
});
