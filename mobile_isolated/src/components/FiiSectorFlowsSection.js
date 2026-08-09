import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {TradingViewLink} from '@components/TradingViewLink';
import {dashboardService} from '@core/api/services/dashboardService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {AYC} from '@core/theme/aycMobileTheme';
import {
  fmtCr,
  nextFiiSectorStockSort,
  normalizeFiiSectorFlowsPayload,
  normalizeFiiSectorStocksPayload,
  sortFiiSectorRows,
  sortFiiSectorStockRows,
} from '@core/utils/fiiDiiPayload';
import {safeFetch} from '@core/utils/safeFetch';

const DEFAULT_STOCK_SORT = {key: 'day1d', direction: 'desc'};

function tone(v) {
  if (v == null || !Number.isFinite(Number(v))) return AYC.muted;
  return Number(v) >= 0 ? AYC.positive : AYC.negative;
}

function sortArrow(active, direction) {
  if (!active) return ' ↕';
  return direction === 'asc' ? ' ↑' : ' ↓';
}

export function FiiSectorFlowsSection() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [stocksPayload, setStocksPayload] = useState(null);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stockSort, setStockSort] = useState(DEFAULT_STOCK_SORT);

  const load = useCallback(async ({refresh = false} = {}) => {
    setLoading(true);
    setError('');
    try {
      const raw = await safeFetch(
        () =>
          dashboardService.fetchFiiSectorFlows({
            sort: 'fortnight_change',
            limit: 40,
            refresh,
            timeoutMs: API_TIMEOUT_MS.screen,
          }),
        {label: 'FII sectors', timeoutMs: API_TIMEOUT_MS.screen, retries: 1},
      );
      setPayload(normalizeFiiSectorFlowsPayload(raw));
    } catch (e) {
      setError(String(e?.message || 'Could not load FII sector flows'));
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sectors = useMemo(
    () => sortFiiSectorRows(payload?.sectors || [], 'fortnightChange'),
    [payload],
  );

  const sortedStocks = useMemo(
    () => sortFiiSectorStockRows(stocksPayload?.stocks || [], stockSort.key, stockSort.direction),
    [stocksPayload, stockSort],
  );

  const openSector = async sector => {
    const name = String(sector || '').trim();
    if (!name) return;
    if (selected === name) {
      setSelected('');
      setStocksPayload(null);
      setStockSort(DEFAULT_STOCK_SORT);
      return;
    }
    setSelected(name);
    setStockSort(DEFAULT_STOCK_SORT);
    setStocksLoading(true);
    try {
      const raw = await safeFetch(
        () =>
          dashboardService.fetchFiiSectorStocks({
            sector: name,
            limit: 25,
            timeoutMs: API_TIMEOUT_MS.screen,
          }),
        {label: 'FII sector stocks', timeoutMs: API_TIMEOUT_MS.screen, retries: 1},
      );
      setStocksPayload(normalizeFiiSectorStocksPayload(raw));
    } catch (e) {
      setStocksPayload({
        ok: false,
        sector: name,
        stocks: [],
        count: 0,
        matchedSectors: [],
      });
      setError(String(e?.message || 'Could not load stocks'));
    } finally {
      setStocksLoading(false);
    }
  };

  const onStockSort = column => {
    setStockSort(prev => nextFiiSectorStockSort(prev, column));
  };

  const stockHeader = (label, column, style) => {
    const active = stockSort.key === column;
    return (
      <Pressable onPress={() => onStockSort(column)} hitSlop={6}>
        <Text style={[styles.th, style, active && styles.thActive]}>
          {label}
          {sortArrow(active, stockSort.direction)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>FII sector additions</Text>
        <Pressable onPress={() => load({refresh: true})} style={styles.refreshBtn}>
          <Text style={styles.refreshTxt}>Refresh</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>
        Fortnightly Screener flows{payload?.asOf ? ` · as of ${payload.asOf}` : ''} · tap headers to sort
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {payload?.authRequired ? (
        <Text style={styles.warn}>
          Screener login required on server. {payload.message || ''}
        </Text>
      ) : null}
      {loading && !sectors.length ? (
        <ActivityIndicator color={AYC.accent} style={{marginVertical: 12}} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.tr}>
              <Text style={[styles.th, styles.sectorCol]}>Sector</Text>
              <Text style={[styles.th, styles.numCol]}>Fortnight</Text>
              <Text style={[styles.th, styles.numCol]}>1Y</Text>
            </View>
            {sectors.map(row => (
              <Pressable key={row.sector} onPress={() => openSector(row.sector)} style={styles.tr}>
                <Text
                  style={[
                    styles.td,
                    styles.sectorCol,
                    selected === row.sector && styles.selected,
                  ]}
                  numberOfLines={1}>
                  {row.sector}
                </Text>
                <Text style={[styles.td, styles.numCol, {color: tone(row.fortnightChange)}]}>
                  {row.fortnightChange == null ? '—' : fmtCr(row.fortnightChange)}
                </Text>
                <Text style={[styles.td, styles.numCol, {color: tone(row.flow1y)}]}>
                  {row.flow1y == null ? '—' : fmtCr(row.flow1y)}
                </Text>
              </Pressable>
            ))}
            {!sectors.length ? <Text style={styles.empty}>No FII sector rows yet.</Text> : null}
          </View>
        </ScrollView>
      )}

      {selected ? (
        <View style={styles.stocksBlock}>
          <Text style={styles.stocksTitle}>Stocks · {selected}</Text>
          {stocksLoading ? (
            <ActivityIndicator color={AYC.accent} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.tr}>
                  {stockHeader('Symbol', 'symbol', styles.symCol)}
                  {stockHeader('CMP', 'price', styles.numCol)}
                  {stockHeader('CHG%', 'day1d', styles.numCol)}
                  {stockHeader('FII %', 'fiiPct', styles.numCol)}
                  {stockHeader('FII Δ', 'fiiPctDelta', styles.numCol)}
                </View>
                {sortedStocks.map(row => (
                  <View key={row.symbol} style={styles.tr}>
                    <View style={styles.symCol}>
                      <TradingViewLink symbol={row.symbol} />
                    </View>
                    <Text style={[styles.td, styles.numCol]}>
                      {row.price == null ? '—' : Number(row.price).toFixed(1)}
                    </Text>
                    <Text style={[styles.td, styles.numCol, {color: tone(row.day1d)}]}>
                      {row.day1d == null
                        ? '—'
                        : `${Number(row.day1d) >= 0 ? '+' : ''}${Number(row.day1d).toFixed(2)}%`}
                    </Text>
                    <Text style={[styles.td, styles.numCol]}>
                      {row.fiiPct == null ? '—' : `${Number(row.fiiPct).toFixed(2)}%`}
                    </Text>
                    <Text style={[styles.td, styles.numCol, {color: tone(row.fiiPctDelta)}]}>
                      {row.fiiPctDelta == null
                        ? '—'
                        : `${Number(row.fiiPctDelta) >= 0 ? '+' : ''}${Number(row.fiiPctDelta).toFixed(2)}`}
                    </Text>
                  </View>
                ))}
                {!sortedStocks.length ? <Text style={styles.empty}>No matching stocks.</Text> : null}
              </View>
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {marginTop: 12, marginBottom: 8},
  head: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: 15, fontWeight: '700', color: AYC.text},
  sub: {fontSize: 11, color: AYC.muted, marginBottom: 8, marginTop: 2},
  refreshBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: AYC.border,
    borderRadius: 6,
  },
  refreshTxt: {fontSize: 12, color: AYC.accent},
  error: {fontSize: 12, color: '#c62828', marginBottom: 6},
  warn: {fontSize: 12, color: '#a15c00', marginBottom: 6},
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AYC.border,
  },
  th: {fontSize: 11, fontWeight: '600', color: AYC.muted},
  thActive: {color: AYC.accent},
  td: {fontSize: 12, color: AYC.text},
  sectorCol: {width: 140, paddingRight: 8},
  symCol: {width: 110, paddingRight: 8},
  numCol: {width: 88, textAlign: 'right'},
  selected: {fontWeight: '700', color: AYC.accent},
  empty: {padding: 12, fontSize: 12, color: AYC.muted},
  stocksBlock: {marginTop: 10},
  stocksTitle: {fontSize: 13, fontWeight: '600', color: AYC.text, marginBottom: 6},
});
