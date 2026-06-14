import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {SymbolAutocomplete} from '@components/SymbolAutocomplete';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {useAuth} from '@core/auth/AuthContext';
import {ordersService} from '@core/api/services/ordersService';
import {brokersService} from '@core/api/services/brokersService';
import {dashboardService} from '@core/api/services/dashboardService';
import {extractApiRows} from '@core/utils/apiPayload';
import {mergeSymbolOptions} from '@core/utils/symbolOptions';
import {brokerSessionSummary} from '@core/utils/startTradeFromAlert';
import {
  brokerRowHasLiveTradingSession,
  estimateRequiredMargin,
  fundsSufficient,
  normalizeProductType,
  productTypeLabel,
  shouldCheckFunds,
} from '@core/utils/tradePreflight';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {runScreenPayloadFetch, runScreenTableFetchWithLivePoll, SCREEN_LIVE_POLL_MS} from '@core/utils/screenPageLoader';
import {enableBrokerIpsForMobile, registerMobileClientIp, summarizeBrokerEnablements} from '@core/utils/mobileClientIp';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

const PRODUCT_TYPES = ['INTRADAY', 'MTF', 'DELIVERY'];
const ORDER_TYPES = ['MARKET', 'LIMIT'];
const SIDES = ['BUY', 'SELL'];

const formatWhen = value => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_) {
    return String(value).slice(0, 16);
  }
};

const formatPrice = value => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', {maximumFractionDigits: 2});
};

const statusStyle = status => {
  const s = String(status || '').toUpperCase();
  if (/REJECT|CANCEL|FAIL/i.test(s)) return styles.statusRejected;
  if (/FILL|COMPLETE|EXECUT/i.test(s)) return styles.statusFilled;
  if (/PEND|OPEN|PLACED/i.test(s)) return styles.statusPending;
  return styles.statusNeutral;
};

const orderRejectionText = order => {
  const direct = order?.rejection_reason || order?.reject_reason || order?.message;
  if (direct) return String(direct);
  const raw = order?.broker_response;
  if (!raw) return '';
  if (typeof raw === 'string') {
    const match = raw.match(/"errorMessage"\s*:\s*"([^"]+)"/);
    return match?.[1] || raw.slice(0, 120);
  }
  return String(raw?.errorMessage || raw?.message || '');
};

const OrderCard = ({order}) => {
  const symbol = String(order?.symbol || '—').toUpperCase();
  const side = String(order?.side || '—').toUpperCase();
  const status = String(order?.status || 'UNKNOWN').toUpperCase();
  const sideStyle = side === 'BUY' ? styles.sideBuy : side === 'SELL' ? styles.sideSell : styles.sideNeutral;
  const rejection = orderRejectionText(order);

  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <Text style={styles.orderSymbol}>{symbol}</Text>
          <View style={[styles.sideBadge, sideStyle]}>
            <Text style={styles.sideBadgeText}>{side}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, statusStyle(status)]}>
          <Text style={styles.statusBadgeText}>{status}</Text>
        </View>
      </View>

      <View style={styles.orderMetaRow}>
        <Text style={styles.orderMeta}>Qty {order?.qty ?? '—'} @ ₹{formatPrice(order?.price ?? order?.entry_price)}</Text>
        <Text style={styles.orderMeta}>{String(order?.order_type || '—')} · {String(order?.product_type || '—')}</Text>
      </View>

      <View style={styles.orderDetailGrid}>
        <Text style={styles.orderDetail}>Entry ₹{formatPrice(order?.entry_price)}</Text>
        <Text style={styles.orderDetail}>SL ₹{formatPrice(order?.stop_loss)}</Text>
        <Text style={styles.orderDetail}>T1 ₹{formatPrice(order?.target_1)}</Text>
        <Text style={styles.orderDetail}>T2 ₹{formatPrice(order?.target_2)}</Text>
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.orderFooterText}>Broker: {String(order?.broker || '—')}</Text>
        <Text style={styles.orderFooterText}>{formatWhen(order?.created_at || order?.placed_at)}</Text>
      </View>

      {rejection ? (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionTitle}>Rejection reason</Text>
          <Text style={styles.rejectionText}>{rejection}</Text>
        </View>
      ) : null}
    </View>
  );
};

const parseNum = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const ToggleGroup = ({values, selected, onSelect}) => (
  <View style={styles.toggleRow}>
    {values.map(v => (
      <Pressable
        key={v}
        onPress={() => onSelect(v)}
        style={[styles.toggleChip, selected === v ? styles.toggleChipSelected : null]}>
        <Text style={[styles.toggleText, selected === v ? styles.toggleTextSelected : null]}>{v}</Text>
      </Pressable>
    ))}
  </View>
);

const uiProductType = apiProduct =>
  normalizeProductType(apiProduct) === 'MARGIN' ? 'MTF' : normalizeProductType(apiProduct);

const apiProductType = uiProduct => (uiProduct === 'MTF' ? 'MARGIN' : normalizeProductType(uiProduct));

export const OrdersScreen = ({route, navigation}) => {
  const {user} = useAuth();
  const userId = String(user?.id || user?.user_id || '');
  const routeParams = route?.params || {};
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [symbol, setSymbol] = useState(String(routeParams.symbol || 'SBIN').toUpperCase());
  const [qty, setQty] = useState('1');
  const [side, setSide] = useState(String(routeParams.side || 'BUY').toUpperCase());
  const [orderType, setOrderType] = useState(String(routeParams.orderType || routeParams.order_type || 'MARKET').toUpperCase());
  const [productType, setProductType] = useState(String(routeParams.productType || routeParams.product_type || 'INTRADAY').toUpperCase());
  const [broker, setBroker] = useState('dhan');
  const [price, setPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [target1, setTarget1] = useState('');
  const [target2, setTarget2] = useState('');
  const [mobileIp, setMobileIp] = useState('');
  const [ipEnableStatus, setIpEnableStatus] = useState('');
  const [brokerRows, setBrokerRows] = useState([]);
  const [algoGate, setAlgoGate] = useState(null);
  const [symbolOptions, setSymbolOptions] = useState([]);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [availableFunds, setAvailableFunds] = useState(null);
  const [fundsError, setFundsError] = useState('');

  const fromAlert = routeParams.fromAlert;
  const requirePreflight = Boolean(routeParams.requirePreflight || fromAlert);
  const mergedSymbolOptions = useMemo(() => mergeSymbolOptions(symbolOptions), [symbolOptions]);

  const fetchOrdersPayload = useCallback(async () => {
    const [resp, setup] = await Promise.all([ordersService.fetchOrders(), brokersService.fetchBrokerSetup()]);
    const orderRows = extractApiRows(resp);
    const rows = extractApiRows(setup);
    const connected = rows.find(row => row?.broker && brokerRowHasLiveTradingSession(row));
    let nextBroker = broker;
    if (connected?.broker) nextBroker = String(connected.broker).toLowerCase();
    else if (routeParams.broker) nextBroker = String(routeParams.broker).toLowerCase();
    let gate = {algo_ready: false, reason: 'Could not verify algo-ready gate from server.'};
    try {
      gate = await dashboardService.fetchAlgoReadyGate();
    } catch (_) {
      /* keep fallback gate */
    }
    return {orders: orderRows, brokerRows: rows, broker: nextBroker, algoGate: gate};
  }, [broker, routeParams.broker]);

  const applyOrdersPayload = useCallback(payload => {
    setOrders(payload.orders || []);
    setBrokerRows(payload.brokerRows || []);
    if (payload.broker) setBroker(String(payload.broker).toLowerCase());
    if (payload.algoGate) setAlgoGate(payload.algoGate);
  }, []);

  const load = useCallback(
    async ({forceRefresh = false} = {}) => {
      await runScreenPayloadFetch({
        cacheKey: MOBILE_PAGE_CACHE_KEYS.orders,
        fetcher: fetchOrdersPayload,
        applyPayload: applyOrdersPayload,
        setLoading,
        setError: msg => {
          if (msg) Alert.alert('Orders', String(msg));
        },
        forceNetwork: forceRefresh,
        hasUsable: data => Array.isArray(data?.orders),
      });
    },
    [applyOrdersPayload, fetchOrdersPayload],
  );

  const selectedBrokerRow = useMemo(
    () => brokerRows.find(row => String(row?.broker || '').toLowerCase() === String(broker || '').toLowerCase()),
    [broker, brokerRows],
  );

  const sessionSummary = useMemo(() => brokerSessionSummary(selectedBrokerRow), [selectedBrokerRow]);

  const isBrokerLiveEnabled = brokerRowHasLiveTradingSession(selectedBrokerRow);
  const isAlgoReady = Boolean(algoGate?.algo_ready);

  const tradePrice = useMemo(() => {
    if (orderType === 'LIMIT') return parseNum(price);
    return parseNum(entryPrice) ?? parseNum(price);
  }, [entryPrice, orderType, price]);

  const marginEstimate = useMemo(
    () =>
      estimateRequiredMargin({
        broker,
        productType: apiProductType(productType),
        qty,
        price: tradePrice,
      }),
    [broker, productType, qty, tradePrice],
  );

  const needsFundsCheck = shouldCheckFunds(side, apiProductType(productType));
  const fundsOk = useMemo(() => {
    if (!needsFundsCheck || !marginEstimate?.requiredAmount) return true;
    if (availableFunds == null) return null;
    return fundsSufficient(availableFunds, marginEstimate.requiredAmount);
  }, [availableFunds, marginEstimate?.requiredAmount, needsFundsCheck]);

  const canPlaceOrder =
    isBrokerLiveEnabled &&
    isAlgoReady &&
    (fundsOk !== false || !needsFundsCheck || availableFunds == null);

  const runPreflight = useCallback(async () => {
    setPreflightBusy(true);
    setFundsError('');
    try {
      const setup = await brokersService.fetchBrokerSetup({userId});
      const rows = extractApiRows(setup, ['data']);
      setBrokerRows(rows.length ? rows : setup);
      const row = (rows.length ? rows : setup).find(
        r => String(r?.broker || '').toLowerCase() === String(broker || '').toLowerCase(),
      );
      if (!brokerRowHasLiveTradingSession(row)) {
        setAvailableFunds(null);
        return {sessionOk: false, availableFunds: null};
      }
      const funds = await brokersService.fetchAvailableFunds(broker, {userId});
      const amount = funds?.available_amount != null ? Number(funds.available_amount) : null;
      if (amount != null) {
        setAvailableFunds(amount);
      } else {
        setAvailableFunds(null);
        setFundsError('Could not load live balance. Margin is estimated; server verifies on submit.');
      }
      return {sessionOk: true, availableFunds: amount};
    } catch (e) {
      setFundsError(String(e?.message || e));
      setAvailableFunds(null);
      return {sessionOk: false, availableFunds: null};
    } finally {
      setPreflightBusy(false);
    }
  }, [broker, userId]);

  const goValidateBroker = () => {
    navigation?.navigate?.('Brokers', {
      returnTo: 'Orders',
      returnParams: routeParams,
      openBrokerSetup: true,
      selectedBroker: broker,
    });
  };

  const placeOrderFromAlert = async () => {
    try {
      if (!isBrokerLiveEnabled) {
        Alert.alert('Broker session required', sessionSummary.detail, [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Validate broker', onPress: goValidateBroker},
        ]);
        return;
      }
      if (!isAlgoReady) {
        throw new Error(`Algo trade gate is blocked: ${algoGate?.reason || 'system not ready'}`);
      }

      if (mobileIp) {
        try {
          const en = await enableBrokerIpsForMobile(mobileIp, broker);
          if (en?.summary) setIpEnableStatus(en.summary);
        } catch (ipErr) {
          setIpEnableStatus(String(ipErr?.message || 'IP enablement failed — order may still proceed'));
        }
      }

      const preflight = await runPreflight();
      if (!preflight.sessionOk) {
        Alert.alert('Broker session required', sessionSummary.detail, [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Validate broker', onPress: goValidateBroker},
        ]);
        return;
      }
      const required = marginEstimate?.requiredAmount;
      const available = preflight.availableFunds;
      if (needsFundsCheck && required && available != null && !fundsSufficient(available, required)) {
        throw new Error(
          `Insufficient margin. Required ₹${required.toFixed(2)}, available ₹${Number(available).toFixed(2)}.`,
        );
      }

      const normalizedSymbol = String(symbol || '').toUpperCase().replace(/^NSE:/, '');
      if (!normalizedSymbol) {
        throw new Error('Symbol is required.');
      }
      const mappedProductType = apiProductType(productType);
      const payload = {
        broker,
        symbol: normalizedSymbol,
        side,
        product_type: mappedProductType,
        order_type: orderType,
        qty: Math.max(1, Number(qty || 1)),
        strategy_tag: 'mobile_live_alert_trade',
        strategy_payload: {
          source: fromAlert?.source || 'mobile_live_alert',
          source_alert_id: fromAlert?.id || null,
          mobile_client_ip: mobileIp || null,
          mobile_trade_enablement: true,
          product_intent: productTypeLabel(mappedProductType),
          entry_price: parseNum(entryPrice),
          stop_loss: parseNum(stopLoss),
          target_1: parseNum(target1),
          target_2: parseNum(target2),
        },
      };
      if (orderType === 'LIMIT') {
        payload.price = parseNum(price);
        if (!payload.price || payload.price <= 0) {
          throw new Error('Limit price is required for LIMIT orders.');
        }
      }
      const trig = parseNum(triggerPrice);
      if (trig && trig > 0) {
        payload.trigger_price = trig;
      }
      await ordersService.placeOrder(payload);
      await load();
      Alert.alert('Order submitted', 'Live order request sent. Check status below.');
    } catch (error) {
      Alert.alert('Place order failed', String(error?.message || error?.detail || error));
    }
  };

  useEffect(() => {
    let pollId;
    (async () => {
      pollId = await runScreenTableFetchWithLivePoll({
        cacheKey: MOBILE_PAGE_CACHE_KEYS.orders,
        fetcher: async () => {
          const payload = await fetchOrdersPayload();
          applyOrdersPayload(payload);
          return payload.orders || [];
        },
        setRows: () => {},
        setLoading,
        setError: () => {},
        liveIntervalMs: SCREEN_LIVE_POLL_MS,
      });
    })();
    registerMobileClientIp({appVersion: '1.0.0'}).then(res => {
      setMobileIp(res.ip || '');
      if (res.enablements?.length) {
        setIpEnableStatus(summarizeBrokerEnablements(res.enablements));
        return;
      }
      const en = res.enablement;
      if (en?.status === 'ok') setIpEnableStatus(summarizeBrokerEnablements([en]));
      else if (en?.status === 'error') setIpEnableStatus(String(en.detail || 'IP enablement pending'));
      else if (res.ip) setIpEnableStatus('IP registered — enablement runs on server');
    });
    dashboardService.fetchAvailableSymbols()
      .then(res => setSymbolOptions(extractApiRows(res)))
      .catch(() => setSymbolOptions([]));
    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [applyOrdersPayload, fetchOrdersPayload]);

  useEffect(() => {
    if (routeParams.symbol) {
      setSymbol(String(routeParams.symbol).toUpperCase());
    }
    if (routeParams.side) {
      setSide(String(routeParams.side).toUpperCase());
    }
    if (routeParams.orderType || routeParams.order_type) {
      setOrderType(String(routeParams.orderType || routeParams.order_type).toUpperCase());
    }
    if (routeParams.productType || routeParams.product_type) {
      setProductType(uiProductType(routeParams.productType || routeParams.product_type));
    }
  }, [routeParams.orderType, routeParams.order_type, routeParams.productType, routeParams.product_type, routeParams.side, routeParams.symbol]);

  useEffect(() => {
    if (routeParams.broker) {
      setBroker(String(routeParams.broker).toLowerCase());
    }
  }, [routeParams.broker]);

  useEffect(() => {
    if (requirePreflight && !loading) {
      runPreflight();
    }
  }, [requirePreflight, loading, runPreflight, broker]);

  useEffect(() => {
    if (!fromAlert) {
      return;
    }
    if (fromAlert?.symbol) {
      setSymbol(String(fromAlert.symbol).toUpperCase().replace(/^NSE:/, ''));
    }
    if (fromAlert?.entry_price != null) {
      setEntryPrice(String(fromAlert.entry_price));
      setPrice(String(fromAlert.entry_price));
      setOrderType('LIMIT');
    }
    if (fromAlert?.stop_loss != null) {
      setStopLoss(String(fromAlert.stop_loss));
    }
    if (fromAlert?.target_1 != null) {
      setTarget1(String(fromAlert.target_1));
    }
    if (fromAlert?.target_2 != null) {
      setTarget2(String(fromAlert.target_2));
    }
    if (fromAlert?.side) {
      setSide(String(fromAlert.side).toUpperCase());
    }
  }, [fromAlert]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScreenScaffold title="Orders" subtitle="Live trade from alerts with entry/exit/SL and broker controls">
      {fromAlert ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>From alert #{fromAlert?.id || '-'}</Text>
          <Text style={styles.bannerText}>
            {fromAlert?.symbol || '-'} · {productTypeLabel(apiProductType(productType))} · {side}
          </Text>
        </View>
      ) : null}
      <View style={[styles.gateCard, sessionSummary.ok ? styles.gateCardOk : styles.gateCardBlocked]}>
        <Text style={[styles.gateTitle, sessionSummary.ok ? styles.gateOkText : styles.gateBlockedText]}>
          Broker session: {sessionSummary.ok ? 'VALIDATED' : 'REQUIRED'}
        </Text>
        <Text style={styles.gateReason}>{sessionSummary.detail}</Text>
        {!sessionSummary.ok ? (
          <Pressable style={styles.linkBtn} onPress={goValidateBroker}>
            <Text style={styles.linkBtnText}>Validate broker session</Text>
          </Pressable>
        ) : null}
      </View>
      {requirePreflight ? (
        <View style={[styles.gateCard, fundsOk === false ? styles.gateCardBlocked : styles.gateCardOk]}>
          <Text style={[styles.gateTitle, fundsOk === false ? styles.gateBlockedText : styles.gateOkText]}>
            Account balance {preflightBusy ? '(checking…)' : fundsOk === false ? 'INSUFFICIENT' : availableFunds != null ? 'OK' : 'ESTIMATE'}
          </Text>
          {marginEstimate ? (
            <Text style={styles.gateReason}>
              Required ~₹{marginEstimate.requiredAmount.toFixed(2)} ({productTypeLabel(apiProductType(productType))} ·{' '}
              {marginEstimate.leverage}x)
            </Text>
          ) : (
            <Text style={styles.gateReason}>Enter qty and price to estimate margin.</Text>
          )}
          {availableFunds != null ? (
            <Text style={styles.gateReason}>Available ₹{Number(availableFunds).toFixed(2)}</Text>
          ) : null}
          {fundsError ? <Text style={styles.gateReason}>{fundsError}</Text> : null}
          <Pressable style={styles.linkBtn} onPress={runPreflight} disabled={preflightBusy}>
            <Text style={styles.linkBtnText}>{preflightBusy ? 'Refreshing…' : 'Refresh balance'}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={[styles.gateCard, isAlgoReady ? styles.gateCardOk : styles.gateCardBlocked]}>
        <Text style={[styles.gateTitle, isAlgoReady ? styles.gateOkText : styles.gateBlockedText]}>
          Algo-ready gate: {isAlgoReady ? 'READY' : 'BLOCKED'}
        </Text>
        <Text style={styles.gateReason}>{algoGate?.reason || 'Loading gate status...'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Broker</Text>
        <ToggleGroup values={['dhan', 'angelone', 'samco', 'upstox']} selected={broker} onSelect={setBroker} />
        <Text style={styles.meta}>
          {isBrokerLiveEnabled
            ? `Live enabled (${selectedBrokerRow?.broker || broker})`
            : 'Broker is not live-enabled. Connect it in Brokers screen first.'}
        </Text>

        <Text style={styles.label}>Side</Text>
        <ToggleGroup values={SIDES} selected={side} onSelect={setSide} />

        <Text style={styles.label}>Order type</Text>
        <ToggleGroup values={ORDER_TYPES} selected={orderType} onSelect={setOrderType} />

        <Text style={styles.label}>Product</Text>
        <ToggleGroup values={PRODUCT_TYPES} selected={productType} onSelect={setProductType} />
        <Text style={styles.meta}>{productTypeLabel(apiProductType(productType))}</Text>

        <Text style={styles.label}>Symbol</Text>
        <SymbolAutocomplete value={symbol} onChange={setSymbol} options={mergedSymbolOptions} placeholder="Search symbol…" />
        <TextInput value={qty} onChangeText={setQty} placeholder="Qty" keyboardType="number-pad" style={styles.input} />
        {orderType === 'LIMIT' ? (
          <TextInput value={price} onChangeText={setPrice} placeholder="Limit price" keyboardType="decimal-pad" style={styles.input} />
        ) : null}
        <TextInput
          value={triggerPrice}
          onChangeText={setTriggerPrice}
          placeholder="Trigger price (optional)"
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <TextInput value={entryPrice} onChangeText={setEntryPrice} placeholder="Entry (from alert)" keyboardType="decimal-pad" style={styles.input} />
        <TextInput value={stopLoss} onChangeText={setStopLoss} placeholder="Stop Loss" keyboardType="decimal-pad" style={styles.input} />
        <TextInput value={target1} onChangeText={setTarget1} placeholder="Target 1" keyboardType="decimal-pad" style={styles.input} />
        <TextInput value={target2} onChangeText={setTarget2} placeholder="Target 2" keyboardType="decimal-pad" style={styles.input} />
        <Text style={styles.meta}>Device IP for broker enablement: {mobileIp || 'Resolving...'}</Text>
        {ipEnableStatus ? <Text style={styles.meta}>{ipEnableStatus}</Text> : null}

        <Pressable
          style={[styles.submitBtn, !canPlaceOrder ? styles.submitBtnDisabled : null]}
          onPress={placeOrderFromAlert}
          disabled={!canPlaceOrder}>
          <Text style={styles.submitBtnText}>Place live order</Text>
        </Pressable>
        <Pressable style={styles.refreshBtn} onPress={() => load({forceRefresh: true})}>
          <Text style={styles.refreshBtnText}>Refresh orders</Text>
        </Pressable>
      </View>

      <View style={styles.ordersSection}>
        <View style={styles.ordersSectionHeader}>
          <Text style={styles.ordersSectionTitle}>Recent orders</Text>
          <Text style={styles.ordersSectionCount}>{orders.length}</Text>
        </View>
        {orders.length ? (
          orders.map(order => <OrderCard key={String(order.id || order.client_order_ref || order.created_at)} order={order} />)
        ) : (
          <View style={styles.ordersEmpty}>
            <Text style={styles.ordersEmptyTitle}>No orders yet</Text>
            <Text style={styles.ordersEmptyText}>Place a live order above or refresh to load history.</Text>
          </View>
        )}
      </View>
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: AYC.pageBg},
  banner: {backgroundColor: '#ecfeff', borderColor: '#67e8f9', borderWidth: 1, borderRadius: 10, padding: 10, gap: 2},
  bannerTitle: {fontSize: AYC.type.body, fontWeight: '800', color: '#155e75'},
  bannerText: {fontSize: AYC.type.caption, color: '#164e63'},
  gateCard: {borderWidth: 1, borderRadius: 10, padding: 10, gap: 2},
  gateCardOk: {backgroundColor: '#ecfdf5', borderColor: '#86efac'},
  gateCardBlocked: {backgroundColor: '#fef2f2', borderColor: '#fca5a5'},
  gateTitle: {fontSize: AYC.type.body, fontWeight: '800'},
  gateOkText: {color: '#166534'},
  gateBlockedText: {color: '#991b1b'},
  gateReason: {fontSize: AYC.type.caption, color: AYC.text},
  linkBtn: {alignSelf: 'flex-start', marginTop: 6, paddingVertical: 4},
  linkBtnText: {fontSize: AYC.type.caption, fontWeight: '800', color: AYC.accent},
  card: {...mobileStyles.card, borderRadius: 12},
  label: {...mobileStyles.label, marginTop: 2},
  toggleRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  toggleChip: {paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: AYC.cardBorder, backgroundColor: AYC.card},
  toggleChipSelected: {backgroundColor: '#dbeafe', borderColor: '#3b82f6'},
  toggleText: {fontSize: AYC.type.caption, color: AYC.text, fontWeight: '600'},
  toggleTextSelected: {color: '#1d4ed8'},
  input: mobileStyles.input,
  meta: mobileStyles.caption,
  submitBtn: {marginTop: 6, backgroundColor: AYC.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center'},
  submitBtnDisabled: {backgroundColor: '#9ca3af'},
  submitBtnText: mobileStyles.btnPrimaryText,
  refreshBtn: mobileStyles.btnSecondary,
  refreshBtnText: mobileStyles.btnSecondaryText,
  ordersSection: {gap: 10},
  ordersSectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  ordersSectionTitle: mobileStyles.cardTitle,
  ordersSectionCount: {
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    color: AYC.textMuted,
    fontWeight: '800',
    fontSize: AYC.type.caption,
  },
  ordersEmpty: {...mobileStyles.card, borderRadius: 12, padding: 16, gap: 4},
  ordersEmptyTitle: mobileStyles.bodyBold,
  ordersEmptyText: {...mobileStyles.caption, lineHeight: 18},
  orderCard: {...mobileStyles.card, borderRadius: 12, padding: 12},
  orderHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  orderHeaderLeft: {flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1},
  orderSymbol: mobileStyles.metricSm,
  sideBadge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999},
  sideBuy: {backgroundColor: '#dcfce7'},
  sideSell: {backgroundColor: '#fee2e2'},
  sideNeutral: {backgroundColor: '#f3f4f6'},
  sideBadgeText: {fontSize: AYC.type.cardLabel, fontWeight: '800', color: AYC.text},
  statusBadge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999},
  statusBadgeText: {fontSize: AYC.type.cardLabel, fontWeight: '800', color: AYC.text},
  statusRejected: {backgroundColor: '#fecaca'},
  statusFilled: {backgroundColor: '#bbf7d0'},
  statusPending: {backgroundColor: '#fde68a'},
  statusNeutral: {backgroundColor: '#e5e7eb'},
  orderMetaRow: {gap: 2},
  orderMeta: mobileStyles.caption,
  orderDetailGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  orderDetail: mobileStyles.muted,
  orderFooter: {flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap'},
  orderFooterText: mobileStyles.muted,
  rejectionBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  rejectionTitle: {fontSize: AYC.type.caption, fontWeight: '800', color: '#991b1b'},
  rejectionText: {fontSize: AYC.type.caption, color: '#7f1d1d', lineHeight: 16},
});
