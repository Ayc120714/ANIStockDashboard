import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {AYC} from '@core/theme/aycMobileTheme';
import {mobileStyles} from '@core/theme/mobileStyles';
import {buildBarMetrics, buildFiiDiiCard, fmtCr} from '@core/utils/fiiDiiPayload';

const POSITIVE = AYC.positive;
const NEGATIVE = AYC.negative;

function CashCard({title, subtitle, card, activeIndex, onSelectBar, loading}) {
  const shown =
    activeIndex != null && card.series?.[activeIndex]
      ? card.series[activeIndex]
      : card.shownPoint || {net: card.latestNet, date: card.latestDate};
  const net = shown?.net ?? card.latestNet ?? 0;
  const netColor = net >= 0 ? POSITIVE : NEGATIVE;
  const mtdColor = (card.mtdNet ?? 0) >= 0 ? POSITIVE : NEGATIVE;
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
          <View style={styles.mtdRow}>
            <Text style={mobileStyles.label}>MTD</Text>
            <Text
              style={[styles.mtdValue, {color: mtdColor}]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              {fmtCr(card.mtdNet)}
            </Text>
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
        </>
      )}
    </View>
  );
}

export function FiiDiiCashCards({data, loading = false}) {
  const [fiiIdx, setFiiIdx] = useState(null);
  const [diiIdx, setDiiIdx] = useState(null);

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
        loading={loading}
      />
      <CashCard
        title="DII Cash"
        subtitle="Domestic Institutional Investors"
        card={diiCard}
        activeIndex={diiIdx}
        onSelectBar={setDiiIdx}
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
  mtdRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 6},
  mtdValue: {
    flex: 1,
    fontSize: AYC.type.caption,
    fontWeight: '800',
    textAlign: 'right',
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
  chart: {flexDirection: 'row', alignItems: 'stretch', height: 68, gap: 2},
  barCol: {flex: 1, height: 68},
  barHalfTop: {flex: 1, justifyContent: 'flex-end'},
  barHalfBottom: {flex: 1, justifyContent: 'flex-start'},
  bar: {borderRadius: 1, width: '100%'},
});
