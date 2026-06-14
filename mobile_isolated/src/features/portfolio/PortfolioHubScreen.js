import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {MobileChrome} from '@components/mobileChrome/MobileChrome';
import {ordersService} from '@core/api/services/ordersService';
import {brokerPortfolioService} from '@core/api/services/brokerPortfolioService';
import {useAuth} from '@core/auth/AuthContext';
import {extractApiRows} from '@core/utils/apiPayload';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {resolveDashboardBrokerHoldings} from '@core/utils/loadBrokerHoldings';
import {runScreenPayloadFetch} from '@core/utils/screenPageLoader';
import {ensureMarketSession, shouldPollLiveMarket} from '@core/utils/marketSession';
import {useFocusEffect} from '@react-navigation/native';
import {navigateToStocksOrders} from '@nav/navigationHelpers';
import {AYC, mobilePad, mobileStyles} from '@core/theme/mobileStyles';

function resolveUserId(user) {
  return String(user?.id || user?.user_id || user?.email || '');
}

async function loadPortfolioPayload(userId) {
  const [portfolioRes, brokerRes, dhanOrdersRes] = await Promise.allSettled([
    ordersService.fetchPortfolioPositions().catch(() => ({data: []})),
    resolveDashboardBrokerHoldings(userId, {forceLive: true}),
    userId ? brokerPortfolioService.fetchDhanOrders({userId}) : Promise.resolve([]),
  ]);

  let positions = portfolioRes.status === 'fulfilled' ? extractApiRows(portfolioRes.value) : [];
  const brokerRows = brokerRes.status === 'fulfilled' ? brokerRes.value?.rows || [] : [];

  if (!positions.length && brokerRows.length) {
    positions = brokerRows;
  }

  let orders = [];
  if (dhanOrdersRes.status === 'fulfilled') {
    orders = extractApiRows(dhanOrdersRes.value);
  }
  if (!orders.length) {
    const fallbackOrders = await ordersService.fetchOrders().catch(() => ({data: []}));
    orders = extractApiRows(fallbackOrders);
  }

  return {
    orders,
    positions,
    brokerConnected: Boolean(brokerRes.status === 'fulfilled' && brokerRes.value?.authenticated),
    activeBroker: brokerRes.status === 'fulfilled' ? brokerRes.value?.activeBroker : null,
  };
}

export function PortfolioHubScreen({navigation}) {
  const {user} = useAuth();
  const userId = resolveUserId(user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState([]);

  const load = useCallback(
    async ({forceRefresh = false} = {}) => {
      await runScreenPayloadFetch({
        cacheKey: MOBILE_PAGE_CACHE_KEYS.portfolio,
        fetcher: () => loadPortfolioPayload(userId),
        applyPayload: payload => {
          setOrders(payload.orders || []);
          setPositions(payload.positions || []);
        },
        setLoading,
        forceNetwork: forceRefresh,
        hasUsable: data => (data?.orders?.length > 0) || (data?.positions?.length > 0),
      });
    },
    [userId],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({forceRefresh: true});
    } finally {
      setRefreshing(false);
    }
  }, [load]);

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

  return (
    <MobileChrome navigation={navigation}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.pad}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Text style={styles.pageTitle}>Portfolio</Text>
        {loading ? <ActivityIndicator style={{marginVertical: 16}} /> : null}

      <View style={styles.card}>
          <Text style={styles.cardTitle}>Open positions</Text>
          {openPos.length ? (
            openPos.map(p => (
              <Text key={`${p.symbol}-${p.product_type || 'pos'}`} style={styles.line}>
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
            orders.slice(0, 12).map((o, idx) => (
              <Text key={String(o.id || o.orderId || idx)} style={styles.line}>
                {o.symbol || o.tradingSymbol} · {o.side || o.transactionType} · {o.status || o.orderStatus}
              </Text>
            ))
          ) : (
            <Text style={styles.placeholder}>No orders available.</Text>
          )}
      </View>

      <Pressable style={styles.secondary} onPress={() => navigateToStocksOrders(navigation)}>
        <Text style={styles.secondaryText}>Open orders screen</Text>
      </Pressable>
      </ScrollView>
    </MobileChrome>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  pageTitle: mobileStyles.pageTitle,
  pad: mobilePad,
  card: {...mobileStyles.card, borderRadius: 14, padding: 16},
  cardTitle: mobileStyles.cardTitle,
  line: mobileStyles.body,
  placeholder: {...mobileStyles.body, color: AYC.textMuted, textAlign: 'center', paddingVertical: 8},
  secondary: mobileStyles.btnOutline,
  secondaryText: mobileStyles.btnOutlineText,
});
