import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {TradeProductPicker} from '@components/TradeProductPicker';
import {useAuth} from '@core/auth/AuthContext';
import {alertsService} from '@core/api/services/alertsService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {safeFetch} from '@core/utils/safeFetch';
import {ensureMarketSession, getMarketPollingIntervalMs} from '@core/utils/marketSession';
import {formatAlertTimeIST} from '@core/utils/alertInboxUtils';
import {formatNowTimeIST} from '@core/utils/istTime';
import {startTradeFromAlert} from '@core/utils/startTradeFromAlert';
import {inferAlertSide} from '@core/utils/tradePreflight';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';

const POLL_MS = 15000;

const numberOrNull = value => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const renderSignalLine = item => {
  const entry = numberOrNull(item?.entry_price);
  const sl = numberOrNull(item?.stop_loss);
  const t1 = numberOrNull(item?.target_1);
  const t2 = numberOrNull(item?.target_2);
  if (entry == null && sl == null && t1 == null && t2 == null) {
    return 'No entry/SL/target data';
  }
  return `Entry ${entry ?? '-'} | SL ${sl ?? '-'} | T1 ${t1 ?? '-'} | T2 ${t2 ?? '-'}`;
};

export const AlertsScreen = ({navigation, embedded = false}) => {
  const {user} = useAuth();
  const userId = String(user?.id || user?.user_id || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [tradePickerAlert, setTradePickerAlert] = useState(null);
  const [loadError, setLoadError] = useState('');

  const normalizeList = raw => {
    if (Array.isArray(raw)) {
      return raw;
    }
    if (Array.isArray(raw?.data)) {
      return raw.data;
    }
    return [];
  };

  const load = useCallback(async ({silent = false, notify = false} = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const resp = await safeFetch(() => alertsService.fetchLiveAdvisorAlerts({limit: 120}), {
        timeoutMs: API_TIMEOUT_MS.screen,
        retries: 2,
        label: 'Alerts',
      });
      const list = normalizeList(resp);
      setAlerts(prev => {
        const prevIds = new Set((prev || []).map(item => String(item?.id || '')));
        const incomingIds = list.map(item => String(item?.id || ''));
        const added = incomingIds.filter(id => id && !prevIds.has(id)).length;
        if (added > 0) {
          setNewCount(added);
        }
        return list;
      });
      setLastSyncAt(new Date());
      setLoadError('');
    } catch (error) {
      const msg = String(error?.message || error || 'Could not load alerts');
      setLoadError(msg);
      if (notify) {
        Alert.alert('Alerts', msg);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load({silent: false});
  }, [load]);

  useEffect(() => {
    if (!autoSync) {
      return undefined;
    }
    let id;
    (async () => {
      await ensureMarketSession();
      const pollMs = getMarketPollingIntervalMs(POLL_MS, 0);
      if (pollMs > 0) {
        id = setInterval(() => {
          load({silent: true});
        }, pollMs);
      }
    })();
    return () => {
      if (id) clearInterval(id);
    };
  }, [autoSync, load]);

  const items = useMemo(() => (Array.isArray(alerts) ? alerts : []), [alerts]);

  if (loading) {
    if (embedded) {
      return (
        <View style={styles.embeddedLoading}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      );
    }
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const content = (
    <>
      <View style={styles.toolbar}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            setNewCount(0);
            load({silent: true, notify: true});
          }}>
          <Text style={styles.primaryBtnText}>{refreshing ? 'Syncing...' : 'Sync now'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => setAutoSync(v => !v)}>
          <Text style={styles.secondaryBtnText}>{autoSync ? 'Auto sync: ON' : 'Auto sync: OFF'}</Text>
        </Pressable>
      </View>

      {loadError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Could not sync alerts</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable style={styles.errorBtn} onPress={() => load({silent: true, notify: true})}>
            <Text style={styles.errorBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.metaCard}>
        <Text style={styles.metaText}>Alerts: {items.length}</Text>
        <Text style={styles.metaText}>New since last sync: {newCount}</Text>
        <Text style={styles.metaSub}>
          Last sync: {lastSyncAt ? `${formatNowTimeIST(lastSyncAt)} IST` : 'Not synced yet'}
        </Text>
      </View>

      {items.map((item, index) => (
        <View key={String(item?.id || `${item?.symbol || 'alert'}-${index}`)} style={styles.alertCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.symbol}>{item?.symbol || 'N/A'}</Text>
            <Text style={styles.severity}>{String(item?.severity || 'info').toUpperCase()}</Text>
          </View>
          <Text style={styles.message}>{item?.message || item?.alert_type || 'Alert'}</Text>
          <Text style={styles.signalLine}>{renderSignalLine(item)}</Text>
          <Text style={styles.time}>{formatAlertTimeIST(item?.timestamp)}</Text>
          <Pressable
            style={styles.tradeBtn}
            onPress={() => setTradePickerAlert(item)}>
            <Text style={styles.tradeBtnText}>Trade this alert</Text>
          </Pressable>
        </View>
      ))}

      <TradeProductPicker
        visible={Boolean(tradePickerAlert)}
        symbol={tradePickerAlert?.symbol}
        onClose={() => setTradePickerAlert(null)}
        onSelect={productType =>
          startTradeFromAlert(navigation, tradePickerAlert, {
            productType,
            side: inferAlertSide(tradePickerAlert),
            userId,
          })
        }
      />

      {items.length === 0 ? <Text style={styles.empty}>No live alerts available right now.</Text> : null}
    </>
  );

  if (embedded) {
    return (
      <ScrollView style={styles.embeddedWrap} contentContainerStyle={styles.embeddedContent} keyboardShouldPersistTaps="handled">
        {content}
      </ScrollView>
    );
  }

  return (
    <ScreenScaffold title="Live Alerts" subtitle="Real-time advisor alerts with entry/exit/SL sync">
      {content}
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: AYC.pageBg},
  embeddedLoading: {alignItems: 'center', justifyContent: 'center', paddingVertical: 24},
  embeddedWrap: {flex: 1},
  embeddedContent: {gap: 10, paddingBottom: 16},
  toolbar: {flexDirection: 'row', gap: 8},
  primaryBtn: {...mobileStyles.btnPrimary, flex: 1},
  primaryBtnText: mobileStyles.btnPrimaryText,
  secondaryBtn: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
    alignItems: 'center',
  },
  secondaryBtnText: {color: '#1e3a8a', fontWeight: '700', fontSize: AYC.type.body},
  metaCard: {...mobileStyles.card, gap: 4},
  metaText: mobileStyles.bodyBold,
  metaSub: mobileStyles.caption,
  alertCard: {...mobileStyles.card, borderRadius: 12, padding: 12, gap: 6},
  rowBetween: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  symbol: mobileStyles.metricSm,
  severity: {fontSize: AYC.type.caption, fontWeight: '700', color: '#7c3aed'},
  message: mobileStyles.body,
  signalLine: mobileStyles.caption,
  time: mobileStyles.muted,
  tradeBtn: {marginTop: 2, backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 10, alignItems: 'center'},
  tradeBtnText: mobileStyles.btnPrimaryText,
  empty: {...mobileStyles.caption, fontStyle: 'italic'},
  errorCard: {
    ...mobileStyles.card,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    gap: 6,
  },
  errorTitle: {fontSize: AYC.type.body, fontWeight: '800', color: '#991b1b'},
  errorText: {fontSize: AYC.type.caption, color: '#7f1d1d', lineHeight: 18},
  errorBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorBtnText: {color: '#fff', fontWeight: '700', fontSize: AYC.type.caption},
});
