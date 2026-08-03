import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';
import {mobileStyles} from '@core/theme/mobileStyles';
import {
  buildBarMetrics,
  buildFiiDiiCard,
  buildPeriodAccessibilityLabel,
  fmtCompactCr,
  fmtCr,
  NEUTRAL_PERIOD_COLOR,
  periodCircleShownPoint,
  periodCircleTone,
} from '@core/utils/fiiDiiPayload';

const POSITIVE = AYC.positive;
const NEGATIVE = AYC.negative;

function toneColor(tone) {
  if (tone === 'positive') return POSITIVE;
  if (tone === 'negative') return NEGATIVE;
  return NEUTRAL_PERIOD_COLOR;
}

function PeriodCircle({item, onSelect}) {
  const tone = periodCircleTone(item.net, item.hasData);
  const color = toneColor(tone);
  const amount = item.hasData ? fmtCompactCr(item.net) : '—';
  const accessibilityLabel = buildPeriodAccessibilityLabel(item.label, item.net, item.hasData, item.year);

  return (
    <Pressable
      style={styles.periodCell}
      accessible
      accessibilityRole={item.hasData ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!item.hasData}
      onPressIn={() => onSelect?.(periodCircleShownPoint(item))}
      onPressOut={() => onSelect?.(null)}>
      <Text style={styles.periodLabel} numberOfLines={1}>
        {item.label}
      </Text>
      <View style={[styles.periodCircle, {borderColor: color}]}>
        <Text
          style={[styles.periodAmount, {color}]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}>
          {amount}
        </Text>
      </View>
    </Pressable>
  );
}

function PeriodCirclesRow({items, columns, onSelect}) {
  if (!items?.length) return null;
  const cellStyle = columns === 3 ? styles.periodCellYear : styles.periodCellQuarter;
  return (
    <View style={styles.periodRow}>
      {items.map((item, index) => (
        <View key={`${item.label}-${index}`} style={cellStyle}>
          <PeriodCircle item={item} onSelect={onSelect} />
        </View>
      ))}
    </View>
  );
}

function CashCard({title, subtitle, card, activeIndex, onSelectBar, activePeriod, onSelectPeriod, loading}) {
  const shown =
    activePeriod ||
    (activeIndex != null && card.series?.[activeIndex]
      ? card.series[activeIndex]
      : card.shownPoint || {net: card.latestNet, date: card.latestDate});
  const net = shown?.net ?? card.latestNet ?? 0;
  const netColor = net >= 0 ? POSITIVE : NEGATIVE;
  const totals = [
    ['MTD', card.mtdNet],
    ['QTD', card.qtdNet],
    ['YTD', card.ytdNet],
  ];
  const bars = useMemo(() => buildBarMetrics(card.bars), [card.bars]);

  return (
    <View style={styles.card}>
      <Text style={mobileStyles.cardTitle}>{title}</Text>
      <Text style={mobileStyles.caption}>{subtitle}</Text>
      {loading ? (
        <ActivityIndicator color={AYC.accent} style={{marginVertical: 12}} />
      ) : (
        <>
          <Text
            style={[styles.netValue, {color: netColor}]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}>
            {fmtCr(net)}
          </Text>
          {shown?.date ? <Text style={mobileStyles.muted}>{shown.date}</Text> : null}
          <View style={styles.totalsRow}>
            {totals.map(([label, total]) => (
              <View key={label} style={styles.totalItem}>
                <Text style={styles.totalLabel}>{label}</Text>
                <Text
                  style={[
                    styles.totalValue,
                    {color: total == null ? NEUTRAL_PERIOD_COLOR : total >= 0 ? POSITIVE : NEGATIVE},
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}>
                  {fmtCr(total)}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.chartWrap}>
            <View style={styles.midLine} />
            {bars?.length ? (
              <View style={styles.chart}>
                {bars.map((bar, i) => (
                  <Pressable
                    key={`bar-${i}`}
                    style={styles.barCol}
                    onPress={() => onSelectBar(i)}
                    onPressOut={() => onSelectBar(null)}>
                    {bar.positive ? (
                      <>
                        <View style={styles.barHalfTop}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: bar.height,
                                backgroundColor: POSITIVE,
                                opacity: activeIndex === i ? 1 : 0.9,
                              },
                            ]}
                          />
                        </View>
                        <View style={styles.barHalfBottom} />
                      </>
                    ) : (
                      <>
                        <View style={styles.barHalfTop} />
                        <View style={styles.barHalfBottom}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: bar.height,
                                backgroundColor: NEGATIVE,
                                opacity: activeIndex === i ? 1 : 0.9,
                              },
                            ]}
                          />
                        </View>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={mobileStyles.muted}>{loading ? 'Loading…' : 'No chart data'}</Text>
            )}
          </View>
          <PeriodCirclesRow items={card.quarters} columns={4} onSelect={onSelectPeriod} />
          <PeriodCirclesRow items={card.years} columns={3} onSelect={onSelectPeriod} />
        </>
      )}
    </View>
  );
}

export function FiiDiiCashCards({data, loading = false}) {
  const [fiiIdx, setFiiIdx] = useState(null);
  const [diiIdx, setDiiIdx] = useState(null);
  const [fiiPeriod, setFiiPeriod] = useState(null);
  const [diiPeriod, setDiiPeriod] = useState(null);

  const fiiCard = useMemo(() => buildFiiDiiCard(data, 'fii'), [data]);
  const diiCard = useMemo(() => buildFiiDiiCard(data, 'dii'), [data]);

  if (!loading && !data) {
    return null;
  }

  return (
    <View style={styles.row}>
      <CashCard
        title="FII Cash"
        subtitle="Foreign Institutional Investors"
        card={fiiCard}
        activeIndex={fiiIdx}
        onSelectBar={setFiiIdx}
        activePeriod={fiiPeriod}
        onSelectPeriod={setFiiPeriod}
        loading={loading}
      />
      <CashCard
        title="DII Cash"
        subtitle="Domestic Institutional Investors"
        card={diiCard}
        activeIndex={diiIdx}
        onSelectBar={setDiiIdx}
        activePeriod={diiPeriod}
        onSelectPeriod={setDiiPeriod}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', gap: 8, marginBottom: 10},
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  netValue: {
    fontSize: AYC.type.metricSm,
    fontWeight: '800',
    marginTop: 4,
  },
  totalsRow: {flexDirection: 'row', gap: 4, marginTop: 6, marginBottom: 6},
  totalItem: {flex: 1, minWidth: 0, alignItems: 'center'},
  totalLabel: {fontSize: 9, fontWeight: '700', color: AYC.textMuted},
  totalValue: {
    width: '100%',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  chartWrap: {height: 72, justifyContent: 'center', marginTop: 4},
  midLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ccc',
  },
  chart: {flexDirection: 'row', alignItems: 'stretch', height: 68, gap: 1},
  barCol: {flex: 1, height: 68, minWidth: 0},
  barHalfTop: {flex: 1, justifyContent: 'flex-end'},
  barHalfBottom: {flex: 1, justifyContent: 'flex-start'},
  bar: {borderRadius: 1, width: '100%'},
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  periodCellQuarter: {
    width: '23%',
    minWidth: 0,
    flexGrow: 1,
  },
  periodCellYear: {
    width: '31%',
    minWidth: 0,
    flexGrow: 1,
  },
  periodCell: {alignItems: 'center', gap: 2},
  periodLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: AYC.textMuted,
    textAlign: 'center',
  },
  periodCircle: {
    width: '100%',
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  periodAmount: {
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'center',
  },
});
