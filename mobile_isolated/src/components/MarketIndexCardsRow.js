import React from 'react';
import {Pressable, ScrollView, Text, useWindowDimensions, View} from 'react-native';
import {
  getIndexCardSnap,
  getIndexCardWidth,
  indexCardStyles as styles,
} from '@core/theme/indexCardLayout';
import {AYC} from '@core/theme/aycMobileTheme';
import {pctColor, trendTagStyle} from '@core/utils/outlookPayload';

function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function numberText(v) {
  if (v == null || v === '') return '--';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('en-IN', {maximumFractionDigits: 2});
}

function itemPct(item) {
  if (item?.day1dNum != null) return item.day1dNum;
  const raw = item?.day1d ?? item?.day_1d ?? item?.perf_1d ?? item?.change_pct ?? item?.pct_change;
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[%+,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function MarketIndexCardsRow({items = [], onPress, showTrend = false}) {
  const {width} = useWindowDimensions();
  const cardWidth = getIndexCardWidth(width);
  const snap = getIndexCardSnap(width);

  if (!items.length) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} snapToInterval={snap}>
        <View style={[styles.card, {width: cardWidth}]}>
          <Text style={styles.name}>Index 1</Text>
          <Text style={styles.price}>--</Text>
          <Text style={styles.pct}>--</Text>
        </View>
        <View style={[styles.card, {width: cardWidth}]}>
          <Text style={styles.name}>Index 2</Text>
          <Text style={styles.price}>--</Text>
          <Text style={styles.pct}>--</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      decelerationRate="fast"
      snapToAlignment="start"
      snapToInterval={snap}
    >
      {items.map((item, idx) => {
        const pct = itemPct(item);
        const pctLabel = item?.day1d ?? formatPct(pct);
        const pctColorVal = pctColor(pctLabel, {
          positive: AYC.positive,
          negative: AYC.negative,
          neutral: AYC.text,
        });
        const tag = trendTagStyle(item?.trendDirection);
        const body = (
          <>
            <Text style={styles.name} numberOfLines={1}>
              {item?.name || item?.symbol || `Index ${idx + 1}`}
            </Text>
            <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
              {numberText(item?.value ?? item?.ltp)}
            </Text>
            <Text style={[styles.pct, {color: pctColorVal}]} numberOfLines={1}>
              {pctLabel}
            </Text>
            {showTrend ? (
              <Text style={[styles.tag, {backgroundColor: tag.backgroundColor}]} numberOfLines={1}>
                {item?.trend || tag.label}
              </Text>
            ) : null}
          </>
        );

        if (onPress) {
          return (
            <Pressable key={`idx-${idx}`} style={[styles.card, {width: cardWidth}]} onPress={onPress}>
              {body}
            </Pressable>
          );
        }

        return (
          <View key={`idx-${idx}`} style={[styles.card, {width: cardWidth}]}>
            {body}
          </View>
        );
      })}
    </ScrollView>
  );
}
