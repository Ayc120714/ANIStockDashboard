import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {TradeProductPicker} from '@components/TradeProductPicker';
import {useAuth} from '@core/auth/AuthContext';
import {alertsService} from '@core/api/services/alertsService';
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

export const AlertsScreen = ({navigation}) => {
  const {user} = useAuth();
  const userId = String(user?.id || user?.user_id || '');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [tradePickerAlert, setTradePickerAlert] = useState(null);

  const normalizeList = raw => {
    if (Array.isArray(raw)) {
      return raw;
    }
    if (Array.isArray(raw?.data)) {
      return raw.data;
    }
    return [];
  };

  const load = useCallback(async ({silent = false} = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const resp = await alertsService.fetchLiveAdvisorAlerts({limit: 120});
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
    } catch (error) {
      Alert.alert('Alerts', String(error?.message || error));
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
    const id = setInterval(() => {
      load({silent: true});
    }, POLL_MS);
    return () => clearInterval(id);
  }, [autoSync, load]);

  const items = useMemo(() => (Array.isArray(alerts) ? alerts : []), [alerts]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScreenScaffold title="Live Alerts" subtitle="Real-time advisor alerts with entry/exit/SL sync">
      <View style={styles.toolbar}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            setNewCount(0);
            load({silent: true});
          }}>
          <Text style={styles.primaryBtnText}>{refreshing ? 'Syncing...' : 'Sync now'}</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => setAutoSync(v => !v)}>
          <Text style={styles.secondaryBtnText}>{autoSync ? 'Auto sync: ON' : 'Auto sync: OFF'}</Text>
        </Pressable>
      </View>

      <View style={styles.metaCard}>
        <Text style={styles.metaText}>Alerts: {items.length}</Text>
        <Text style={styles.metaText}>New since last sync: {newCount}</Text>
        <Text style={styles.metaSub}>
          Last sync: {lastSyncAt ? lastSyncAt.toLocaleTimeString() : 'Not synced yet'}
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
          <Text style={styles.time}>{item?.timestamp ? String(item.timestamp) : '-'}</Text>
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
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: AYC.pageBg},
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
});
