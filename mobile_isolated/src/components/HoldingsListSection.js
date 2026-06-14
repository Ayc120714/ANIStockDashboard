import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {formatINR} from '@core/utils/formatMarket';
import {
  formatHoldingPct,
  holdingAvgPrice,
  holdingLtp,
  holdingPnlAmount,
  holdingPnlPctFromAvg,
  holdingQty,
  holdingSymbol,
  pnlColor,
  summarizeHoldings,
} from '@core/utils/holdingMetrics';
import {AYC} from '@core/theme/aycMobileTheme';

function SummaryChip({label, value}) {
  const color = pnlColor(value);
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, {color}]}>{formatINR(value)}</Text>
    </View>
  );
}

function HoldingsRow({item}) {
  const pnl = holdingPnlAmount(item);
  const pnlPct = holdingPnlPctFromAvg(item);
  const state = String(item?.state || 'OPEN').toUpperCase();

  return (
    <View style={styles.row}>
      <Text style={[styles.cell, styles.colSym]} numberOfLines={1}>
        {holdingSymbol(item)}
      </Text>
      <Text style={[styles.cell, styles.colNum]}>{holdingQty(item)}</Text>
      <Text style={[styles.cell, styles.colNum]}>{formatINR(holdingAvgPrice(item))}</Text>
      <Text style={[styles.cell, styles.colNum]}>{formatINR(holdingLtp(item))}</Text>
      <Text style={[styles.cell, styles.colNum, {color: pnlColor(pnl), fontWeight: '800'}]}>
        {pnl != null ? formatINR(pnl) : '—'}
      </Text>
      <Text style={[styles.cell, styles.colPct, {color: pnlColor(pnlPct), fontWeight: '800'}]}>
        {formatHoldingPct(pnlPct)}
      </Text>
      <Text style={[styles.cell, styles.colState]}>{state}</Text>
    </View>
  );
}

export function HoldingsListSection({
  holdings = [],
  brokerConnected = false,
  loading = false,
  onConnectBroker,
}) {
  const summary = useMemo(() => summarizeHoldings(holdings), [holdings]);

  if (!brokerConnected) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>
          Connect broker in Brokers to view live holdings.
        </Text>
        {onConnectBroker ? (
          <Pressable onPress={onConnectBroker}>
            <Text style={styles.link}>Open Brokers</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (loading && !holdings.length) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={AYC.accent} />
        <Text style={styles.muted}>Loading holdings…</Text>
      </View>
    );
  }

  if (!holdings.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>
          No holdings found yet. Connect your broker and place orders to see holdings here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.summaryRow}>
        <SummaryChip label="Total Holdings P&L" value={summary.totalHoldingsPnl} />
        <SummaryChip label="Day P&L" value={summary.dayPnl} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.th, styles.colSym]}>Symbol</Text>
            <Text style={[styles.th, styles.colNum]}>Qty</Text>
            <Text style={[styles.th, styles.colNum]}>Avg</Text>
            <Text style={[styles.th, styles.colNum]}>LTP</Text>
            <Text style={[styles.th, styles.colNum]}>P&L</Text>
            <Text style={[styles.th, styles.colPct]}>P&L %</Text>
            <Text style={[styles.th, styles.colState]}>State</Text>
          </View>
          {holdings.map((item, idx) => (
            <HoldingsRow
              key={`${holdingSymbol(item)}_${item?.product_type || 'row'}_${idx}`}
              item={item}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    backgroundColor: '#fff',
    padding: 10,
    gap: 10,
  },
  center: {alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 72},
  muted: {fontSize: 12, color: AYC.textMuted, lineHeight: 18},
  link: {fontSize: 12, fontWeight: '800', color: AYC.accent, marginTop: 4},
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    flexGrow: 1,
    minWidth: '46%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  chipLabel: {fontSize: 10, fontWeight: '700', color: AYC.textMuted},
  chipValue: {fontSize: 13, fontWeight: '800'},
  headRow: {borderBottomWidth: 2, borderBottomColor: '#e5e7eb', paddingBottom: 6},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 8,
    gap: 6,
  },
  th: {fontSize: 10, fontWeight: '800', color: '#6b7280'},
  cell: {fontSize: 11, fontWeight: '700', color: AYC.text},
  colSym: {width: 72},
  colNum: {width: 72, textAlign: 'right'},
  colPct: {width: 56, textAlign: 'right'},
  colState: {width: 52, textAlign: 'center', fontSize: 9, fontWeight: '800', color: '#1b5e20'},
});
