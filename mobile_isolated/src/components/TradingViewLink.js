import React from 'react';
import {Linking, Pressable, StyleSheet, View} from 'react-native';

export function tradingViewChartUrl(symbol, chartSymbol) {
  const full =
    String(chartSymbol || '').trim() ||
    (String(symbol || '').trim() ? `NSE:${String(symbol).trim()}` : '');
  if (!full) return '';
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(full)}`;
}

/** Same NSE chart link as web `TradingViewLink` (equity + index chartSymbol). */
export function TradingViewLink({symbol, chartSymbol, size = 18}) {
  const full =
    String(chartSymbol || '').trim() ||
    (String(symbol || '').trim() ? `NSE:${String(symbol).trim()}` : '');
  if (!full) return null;

  const openChart = () => {
    const url = tradingViewChartUrl(symbol, chartSymbol);
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <Pressable
      onPress={openChart}
      accessibilityRole="link"
      accessibilityLabel={`View ${full} on TradingView`}
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
