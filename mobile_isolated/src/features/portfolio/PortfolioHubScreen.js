import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {ordersService} from '@core/api/services/ordersService';
import {extractApiRows} from '@core/utils/apiPayload';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {runScreenPayloadFetch} from '@core/utils/screenPageLoader';
import {ensureMarketSession, shouldPollLiveMarket} from '@core/utils/marketSession';
import {useFocusEffect} from '@react-navigation/native';
import {AYC, mobilePad, mobileStyles} from '@core/theme/mobileStyles';

function sumPnL(rows, field) {
  return (rows || []).reduce((a, r) => a + (Number(r[field]) || 0), 0);
}

export function PortfolioHubScreen({navigation}) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState([]);

  const load = useCallback(async ({forceRefresh = false} = {}) => {
    await runScreenPayloadFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.portfolio,
      fetcher: async () => {
        const [o, p] = await Promise.all([
          ordersService.fetchOrders().catch(() => ({data: []})),
          ordersService.fetchPortfolioPositions().catch(() => ({data: []})),
        ]);
        return {
          orders: extractApiRows(o),
          positions: extractApiRows(p),
        };
      },
      applyPayload: payload => {
        setOrders(payload.orders || []);
        setPositions(payload.positions || []);
      },
      setLoading,
      forceNetwork: forceRefresh,
      hasUsable: data => (data?.orders?.length > 0) || (data?.positions?.length > 0),
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await ensureMarketSession();
        const session = await ensureMarketSession();
        await load({forceRefresh: shouldPollLiveMarket(session)});
      })();
    }, [load]),
  );

  const openPos = positions.filter(x => String(x.state || '').toLowerCase() === 'open' || Number(x.net_qty));
  const closedTrades = orders.filter(x => /FILLED|CLOSED|COMPLETE/i.test(String(x.status || '')));
  const realized = sumPnL(positions, 'realized_pnl');
  const unreal = sumPnL(positions, 'unrealized_pnl');

  return (
    <ScreenScaffold title="Portfolio manager" subtitle="Live orders & positions">
      {loading ? <ActivityIndicator style={{marginTop: 16}} /> : null}
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={styles.pills}>
          <View style={[styles.pill, styles.pillBlue]}>
            <Text style={styles.pillTxt}>Open: {openPos.length}</Text>
          </View>
          <View style={[styles.pill, styles.pillGrey]}>
            <Text style={styles.pillTxt}>Closed: {closedTrades.length}</Text>
          </View>
          <View style={[styles.pill, styles.pillGr]}>
            <Text style={styles.pillTxt}>Realized: ₹{realized.toFixed(2)}</Text>
          </View>
          <View style={[styles.pill, styles.pillOr]}>
            <Text style={styles.pillTxt}>Unrealized: ₹{unreal.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Open positions</Text>
          {openPos.length ? (
            openPos.map(p => (
              <Text key={p.id} style={styles.line}>
                {p.symbol} · qty {p.net_qty} · LTP {p.ltp ?? '—'}
              </Text>
            ))
          ) : (
            <Text style={styles.placeholder}>No open positions.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent orders</Text>
          {orders.slice(0, 12).length ? (
            orders.slice(0, 12).map(o => (
              <Text key={String(o.id)} style={styles.line}>
                {o.symbol} · {o.side} · {o.status}
              </Text>
            ))
          ) : (
            <Text style={styles.placeholder}>No orders available.</Text>
          )}
        </View>

        <Pressable style={styles.secondary} onPress={() => navigation.navigate('Orders')}>
          <Text style={styles.secondaryText}>Open orders screen</Text>
        </Pressable>
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  pad: mobilePad,
  pills: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  pill: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999},
  pillBlue: {backgroundColor: '#1d4ed8'},
  pillGrey: {backgroundColor: '#94a3b8'},
  pillGr: {backgroundColor: '#15803d'},
  pillOr: {backgroundColor: '#ea580c'},
  pillTxt: {color: '#fff', fontWeight: '800', fontSize: AYC.type.caption},
  card: {...mobileStyles.card, borderRadius: 14, padding: 16},
  cardTitle: mobileStyles.cardTitle,
  line: mobileStyles.body,
  placeholder: {...mobileStyles.body, color: AYC.textMuted, textAlign: 'center', paddingVertical: 8},
  secondary: mobileStyles.btnOutline,
  secondaryText: mobileStyles.btnOutlineText,
});
