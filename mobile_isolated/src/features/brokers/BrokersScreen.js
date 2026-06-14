import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {useAuth} from '@core/auth/AuthContext';
import {brokersService, connectBroker} from '@core/api/services/brokersService';
import {ordersService} from '@core/api/services/ordersService';
import {extractApiRows} from '@core/utils/apiPayload';
import {setBrokerCallbackHandler} from '@features/brokers/useBrokerDeepLinking';
import {AYC, mobileStyles} from '@core/theme/mobileStyles';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';
import {runScreenPayloadFetch} from '@core/utils/screenPageLoader';
import {
  enableBrokerIpsForMobile,
  fetchMobileClientIpStatus,
  registerMobileClientIp,
  summarizeBrokerEnablements,
} from '@core/utils/mobileClientIp';
import {
  mergeBrokerRowsWithAccount,
  pendingDhanConnectKey,
  persistBrokerDraftForRow,
  readBrokerDraft,
  resolveDhanClientIdForSubmit,
} from '@core/storage/brokerDraftStorage';
import {
  BROKER_CREDENTIAL_FIELDS,
  BROKER_DOCS,
  BROKER_FIELD_HINTS,
  BROKER_LABELS,
  BROKER_ORDER,
  DHAN_DAILY_CONSENT_LIMIT,
  emptyCredentials,
  formatLastAuthIST,
  hasBrokerCredentials,
  isLiveExecution,
  orderLabel,
  positionLabel,
} from '@features/brokers/brokerConfig';
import {navigateToStocksOrders} from '@nav/navigationHelpers';

const pickRows = payload => extractApiRows(payload, ['data', 'positions', 'orders', 'items']);

function buildValidatePayload(row, userId, draftCred = {}) {
  const cred = row.credentials || emptyCredentials();
  const broker = String(row.broker || '').toLowerCase();
  const clientId =
    broker === 'dhan'
      ? resolveDhanClientIdForSubmit(row.client_id, cred.mobile)
      : String(row.client_id || '').trim();
  return {
    user_id: userId,
    broker: row.broker,
    client_id: clientId,
    pin: String(cred.pin || draftCred.pin || '').trim(),
    totp: String(cred.totp || draftCred.totp || '').replace(/\s/g, '').trim(),
    api_key: String(cred.api_key || draftCred.api_key || '').trim(),
    api_secret: String(cred.api_secret || draftCred.api_secret || '').trim(),
    token_id: String(cred.token_id || '').trim(),
    client_secret: String(cred.client_secret || draftCred.client_secret || '').trim(),
    redirect_uri: String(cred.redirect_uri || draftCred.redirect_uri || '').trim(),
    auth_code: String(cred.auth_code || draftCred.auth_code || '').trim(),
    access_token: String(cred.access_token || '').trim(),
    yob: broker === 'samco' ? String(cred.api_secret || draftCred.api_secret || '').trim() : '',
  };
}

export const BrokersScreen = ({route, navigation, embedded = false}) => {
  const {user} = useAuth();
  const userId = String(user?.id || user?.user_id || '');
  const isAdmin = Boolean(user?.is_super_admin || user?.is_admin);
  const returnTo = route?.params?.returnTo;
  const returnParams = route?.params?.returnParams;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedBroker, setSelectedBroker] = useState('dhan');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [accountHint, setAccountHint] = useState('');
  const [mobileIp, setMobileIp] = useState('');
  const [ipEnableStatus, setIpEnableStatus] = useState('');

  const brokerRows = rows;
  const activeRow = useMemo(
    () => rows.find(r => r.broker === selectedBroker) || rows[0] || null,
    [rows, selectedBroker],
  );
  const credentialsReady = useMemo(() => hasBrokerCredentials(activeRow), [activeRow]);
  const liveCount = useMemo(() => brokerRows.filter(isLiveExecution).length, [brokerRows]);

  const updateRow = useCallback(
    (broker, patch) => {
      setRows(prev => {
        const next = prev.map(r => (r.broker === broker ? {...r, ...patch} : r));
        const updated = next.find(r => r.broker === broker);
        if (updated && userId) {
          persistBrokerDraftForRow(userId, updated);
        }
        return next;
      });
    },
    [userId],
  );

  const updateCredential = useCallback(
    (broker, key, value) => {
      setRows(prev => {
        const next = prev.map(r =>
          r.broker === broker
            ? {...r, credentials: {...(r.credentials || emptyCredentials()), [key]: value}}
            : r,
        );
        const updated = next.find(r => r.broker === broker);
        if (updated && userId) {
          persistBrokerDraftForRow(userId, updated);
        }
        return next;
      });
    },
    [userId],
  );

  const buildAccountHint = useCallback(async merged => {
    const dhan = merged.find(r => r.broker === 'dhan');
    if (!dhan?.client_id) return '';
    const draft = await readBrokerDraft(userId, 'dhan');
    const restoredDraft = Boolean(
      draft?.credentials?.api_key || draft?.credentials?.pin || dhan?.credentials?.api_key,
    );
    if (dhan.has_session) {
      return 'Your Dhan Client ID is loaded from your account. Session is active.';
    }
    if (dhan.token_stored || dhan.last_auth_at) {
      return restoredDraft
        ? 'Account details restored. Tap Validate to renew your saved Dhan session.'
        : 'Client ID loaded from your account. Tap Validate to renew session, or enter PIN/TOTP if needed.';
    }
    if (restoredDraft || dhan?.credentials?.api_key) {
      return 'Saved broker details restored from your account or this device.';
    }
    return 'Client ID loaded from your account. Enter PIN/TOTP or App ID/Secret to connect.';
  }, [userId]);

  const fetchBrokerSetupPayload = useCallback(async () => {
    const setup = await brokersService.fetchBrokerSetup({userId});
    const apiRows = extractApiRows(setup, ['data']);
    const merged = await mergeBrokerRowsWithAccount(userId, apiRows.length ? apiRows : setup);
    const hint = await buildAccountHint(merged);
    return {rows: merged, accountHint: hint};
  }, [buildAccountHint, userId]);

  const applyBrokerPayload = useCallback(payload => {
    setRows(payload.rows || []);
    setAccountHint(payload.accountHint || '');
  }, []);

  const syncMobileIp = useCallback(async () => {
    try {
      const res = await registerMobileClientIp();
      setMobileIp(res.ip || '');
      if (res.enablements?.length) {
        setIpEnableStatus(summarizeBrokerEnablements(res.enablements));
        return;
      }
      const en = res.enablement;
      if (en?.status === 'ok') {
        setIpEnableStatus(summarizeBrokerEnablements([en]));
      } else if (en?.status === 'error') {
        setIpEnableStatus(String(en.detail || 'IP enablement pending'));
      } else if (res.ip) {
        const status = await fetchMobileClientIpStatus().catch(() => null);
        if (status?.broker_enablement && Object.keys(status.broker_enablement).length) {
          const rows = Object.entries(status.broker_enablement).map(([broker, row]) => ({
            broker,
            status: row?.status,
            detail: row?.detail || row?.last_error,
          }));
          setIpEnableStatus(summarizeBrokerEnablements(rows));
        } else if (status?.pending_enablement) {
          setIpEnableStatus('IP registered — server will enable for connected brokers');
        } else if (status?.ip) {
          setIpEnableStatus(`Registered IP: ${status.ip}`);
        }
      }
    } catch (_) {
      /* non-blocking */
    }
  }, []);

  const load = useCallback(
    async ({forceRefresh = false} = {}) => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setError('');
      await runScreenPayloadFetch({
        cacheKey: MOBILE_PAGE_CACHE_KEYS.brokersSetup(userId),
        fetcher: fetchBrokerSetupPayload,
        applyPayload: applyBrokerPayload,
        setLoading,
        setError: msg => {
          if (msg) setError(String(msg));
        },
        forceNetwork: forceRefresh,
        hasUsable: data => Array.isArray(data?.rows) && data.rows.length > 0,
      });
    },
    [applyBrokerPayload, fetchBrokerSetupPayload, userId],
  );

  const loadLiveData = useCallback(async () => {
    if (!activeRow?.has_session) {
      setPositions([]);
      setOrders([]);
      return;
    }
    try {
      const broker = String(activeRow.broker || 'dhan').toLowerCase();
      const [posRes, ordRes, portfolioRes, ordersRes] = await Promise.all([
        brokersService.fetchBrokerPositions(broker).catch(() => null),
        brokersService.fetchBrokerOrders(broker).catch(() => null),
        ordersService.fetchPortfolioPositions().catch(() => null),
        ordersService.fetchOrders().catch(() => null),
      ]);
      const brokerPositions = pickRows(posRes);
      const brokerOrders = pickRows(ordRes);
      const portfolioPositions = pickRows(portfolioRes);
      const allOrders = extractApiRows(ordersRes);
      setPositions(brokerPositions.length ? brokerPositions : portfolioPositions);
      setOrders(brokerOrders.length ? brokerOrders : allOrders.slice(0, 20));
    } catch (_) {
      setPositions([]);
      setOrders([]);
    }
  }, [activeRow?.broker, activeRow?.has_session]);

  const finishReturnNavigation = useCallback(() => {
    if (!returnTo || !navigation) return;
    const params = returnParams || {};
    if (embedded || String(returnTo).toLowerCase() === 'orders') {
      navigateToStocksOrders(navigation, params);
      return;
    }
    navigation.navigate(returnTo, params);
  }, [embedded, navigation, returnParams, returnTo]);

  useEffect(() => {
    load();
    syncMobileIp();
  }, [load, syncMobileIp]);

  useFocusEffect(
    useCallback(() => {
      syncMobileIp();
    }, [syncMobileIp]),
  );

  useEffect(() => {
    const preferred = String(route?.params?.selectedBroker || '').toLowerCase();
    if (preferred && BROKER_ORDER.includes(preferred)) {
      setSelectedBroker(preferred);
    }
  }, [route?.params?.selectedBroker]);

  useFocusEffect(
    useCallback(() => {
      if (activeRow?.has_session) {
        loadLiveData();
      }
    }, [activeRow?.has_session, loadLiveData]),
  );

  useEffect(() => {
    setBrokerCallbackHandler(async parsed => {
      const tokenId =
        parsed?.tokenId || parsed?.token_id || parsed?.authCode || '';
      if (String(parsed?.provider || '').toLowerCase() === 'dhan' && tokenId) {
        try {
          setBusy(true);
          let pending = {};
          try {
            const raw = await AsyncStorage.getItem(pendingDhanConnectKey(userId));
            pending = raw ? JSON.parse(raw) : {};
          } catch {
            pending = {};
          }
          const draft = await readBrokerDraft(userId, 'dhan');
          const dCred = draft?.credentials || {};
          const clientId = resolveDhanClientIdForSubmit(
            pending?.client_id || activeRow?.client_id || draft?.client_id,
            dCred?.mobile,
          );
          await brokersService.connectDhan({
            user_id: userId,
            token_id: tokenId,
            client_id: clientId,
            api_key: String(pending?.api_key || activeRow?.credentials?.api_key || dCred.api_key || '').trim(),
            api_secret: String(
              pending?.api_secret || activeRow?.credentials?.api_secret || dCred.api_secret || '',
            ).trim(),
          });
          setMessage('Dhan callback completed. Session updated.');
          await AsyncStorage.removeItem(pendingDhanConnectKey(userId));
          await load();
          await loadLiveData();
          if (returnTo) {
            finishReturnNavigation();
          }
        } catch (err) {
          Alert.alert('Dhan callback', String(err?.message || err));
        } finally {
          setBusy(false);
        }
      }
    });
    return () => setBrokerCallbackHandler(null);
  }, [activeRow?.client_id, activeRow?.credentials?.api_key, activeRow?.credentials?.api_secret, finishReturnNavigation, load, loadLiveData, returnTo, userId]);

  const saveRow = async row => {
    if (row.broker !== 'dhan') {
      await brokersService.saveBrokerSetup({
        user_id: userId,
        broker: row.broker,
        client_id: String(row.client_id || '').trim(),
        is_enabled: Boolean(row.is_enabled),
        has_session: Boolean(row.has_session),
      });
    }
  };

  const onSave = async () => {
    if (!activeRow) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await saveRow(activeRow);
      setMessage(`${BROKER_LABELS[activeRow.broker] || activeRow.broker} setup saved.`);
      await load();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const onValidate = async () => {
    if (!activeRow) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const draft = await readBrokerDraft(userId, activeRow.broker);
      const draftCred = draft?.credentials || {};
      const payload = buildValidatePayload(activeRow, userId, draftCred);
      if (mobileIp) {
        payload.mobile_client_ip = mobileIp;
      }
      if (!activeRow.is_enabled) {
        await saveRow(activeRow);
        setMessage(`${BROKER_LABELS[activeRow.broker]} saved for later. Enable integration when ready.`);
        return;
      }

      if (activeRow.broker === 'dhan') {
        if (payload.client_id && !/^\d{5,16}$/.test(payload.client_id)) {
          throw new Error('Dhan Client ID must be 5–16 digits from web.dhan.co.');
        }
        const canRenew =
          Boolean(activeRow.token_stored || activeRow.last_auth_at) &&
          !payload.pin &&
          !payload.totp &&
          !payload.token_id;
        const connectRes = await brokersService.connectDhan({
          ...payload,
          renew_token: canRenew,
        });
        if (connectRes?.requires_token_id && connectRes?.login_url) {
          await AsyncStorage.setItem(
            pendingDhanConnectKey(userId),
            JSON.stringify({
              client_id: String(connectRes?.client_id || payload.client_id || '').trim(),
              api_key: payload.api_key,
              api_secret: payload.api_secret,
            }),
          );
          setMessage(connectRes?.message || 'Complete Dhan login in the browser, then return to the app.');
          await Linking.openURL(String(connectRes.login_url));
          return;
        }
        if (connectRes?.session_token) {
          updateCredential('dhan', 'access_token', String(connectRes.session_token));
          payload.access_token = String(connectRes.session_token);
        }
        setMessage(`${BROKER_LABELS.dhan} validation successful.`);
        await persistBrokerDraftForRow(userId, activeRow);
        const ipRes = await registerMobileClientIp();
        const ip = ipRes?.ip || mobileIp;
        if (ip) {
          setMobileIp(ip);
          try {
            const en = await enableBrokerIpsForMobile(ip, 'dhan');
            if (en?.summary) setIpEnableStatus(en.summary);
          } catch (ipErr) {
            setIpEnableStatus(String(ipErr?.message || 'IP enablement pending'));
          }
        }
        await load({forceRefresh: true});
        await loadLiveData();
        if (returnTo) {
          finishReturnNavigation();
        }
        return;
      }

      await connectBroker(activeRow.broker, payload);

      const res =
        activeRow.broker === 'dhan'
          ? {validated: true}
          : await brokersService.validateBrokerSetup(payload);
      if (res?.validated) {
        setMessage(`${BROKER_LABELS[activeRow.broker]} validation successful.`);
        await persistBrokerDraftForRow(userId, activeRow);
        const ipRes = await registerMobileClientIp();
        const ip = ipRes?.ip || mobileIp;
        if (ip) {
          setMobileIp(ip);
          try {
            const en = await enableBrokerIpsForMobile(ip, activeRow.broker);
            if (en?.summary) {
              setIpEnableStatus(en.summary);
            } else if (res?.ip_enablements?.length) {
              setIpEnableStatus(summarizeBrokerEnablements(res.ip_enablements));
            }
          } catch (ipErr) {
            setIpEnableStatus(String(ipErr?.message || 'IP enablement pending'));
          }
        } else if (res?.ip_enablements?.length) {
          setIpEnableStatus(summarizeBrokerEnablements(res.ip_enablements));
        }
        await load({forceRefresh: true});
        await loadLiveData();
        if (returnTo) {
          finishReturnNavigation();
        }
      } else {
        setError(res?.reason || 'Validation did not activate a session. Check credentials.');
        await load();
      }
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const openDocs = () => {
    const url = activeRow?.doc_url || BROKER_DOCS[activeRow?.broker];
    if (url) Linking.openURL(url);
  };

  if (loading) {
    if (embedded) {
      return (
        <View style={styles.embeddedLoading}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      );
    }
    return (
      <ScreenScaffold title="Brokers" subtitle="Broker integration">
        <ActivityIndicator style={{marginTop: 24}} color="#2563eb" />
      </ScreenScaffold>
    );
  }

  const fields = BROKER_CREDENTIAL_FIELDS[activeRow?.broker] || [];

  const content = (
    <>
      {returnTo ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Validate your broker session, then you will return to {returnTo} to place the alert trade.
          </Text>
        </View>
      ) : null}
      {isAdmin ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Live execution: {liveCount > 0 ? `${liveCount} broker session(s) active.` : 'Activate broker session to place live orders.'}
          </Text>
        </View>
      ) : null}

      {accountHint ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>{accountHint}</Text>
        </View>
      ) : null}

      {mobileIp ? (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            Device IP: {mobileIp}
            {ipEnableStatus ? ` · ${ipEnableStatus}` : ''}
          </Text>
        </View>
      ) : null}

      {message ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{message}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Select broker</Text>
        <View style={styles.chipRow}>
          {BROKER_ORDER.map(broker => {
            const row = brokerRows.find(r => r.broker === broker);
            const selected = selectedBroker === broker;
            return (
              <Pressable
                key={broker}
                onPress={() => setSelectedBroker(broker)}
                style={[styles.chip, selected ? styles.chipSelected : null]}>
                <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
                  {BROKER_LABELS[broker] || broker}
                </Text>
                {row?.has_session ? <View style={styles.chipDot} /> : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable style={styles.secondaryBtn} onPress={load} disabled={busy}>
          <Text style={styles.secondaryBtnText}>Refresh broker setup</Text>
        </Pressable>
      </View>

      {activeRow ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{BROKER_LABELS[activeRow.broker] || activeRow.broker}</Text>
          <Text style={styles.hint}>{BROKER_FIELD_HINTS[activeRow.broker]}</Text>

          <Text style={styles.label}>
            {activeRow.broker === 'dhan' ? 'Dhan Client ID (numeric)' : 'Client ID'}
          </Text>
          <TextInput
            value={String(activeRow.client_id || '')}
            onChangeText={v => {
              const next =
                activeRow.broker === 'dhan' ? v.replace(/\D/g, '').slice(0, 16) : v;
              updateRow(activeRow.broker, {client_id: next});
            }}
            placeholder={activeRow.broker === 'dhan' ? 'Numeric Client ID' : 'Client ID'}
            keyboardType={activeRow.broker === 'dhan' ? 'number-pad' : 'default'}
            style={styles.input}
            autoCapitalize="none"
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable now</Text>
            <Switch
              value={Boolean(activeRow.is_enabled)}
              onValueChange={v => updateRow(activeRow.broker, {is_enabled: v})}
            />
          </View>

          {fields.map(field => (
            <View key={field.key}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                value={String(activeRow.credentials?.[field.key] || '')}
                onChangeText={v => updateCredential(activeRow.broker, field.key, v)}
                placeholder={field.label}
                secureTextEntry={Boolean(field.secret)}
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
          ))}

          <View style={styles.statusRow}>
            <View style={[styles.badge, activeRow.has_session ? styles.badgeOk : styles.badgeMuted]}>
              <Text style={styles.badgeText}>{activeRow.has_session ? 'Session active' : 'No session'}</Text>
            </View>
            {isAdmin ? (
              <View style={[styles.badge, isLiveExecution(activeRow) ? styles.badgeLive : styles.badgeMuted]}>
                <Text style={styles.badgeText}>
                  {isLiveExecution(activeRow) ? 'LIVE enabled' : 'Session required'}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta}>
            {activeRow.last_auth_at
              ? `Last auth (IST): ${formatLastAuthIST(activeRow.last_auth_at)}`
              : 'Validate to create broker session.'}
          </Text>

          {!activeRow.is_enabled ? (
            <Text style={styles.warnText}>Turn on Enable now after entering broker details.</Text>
          ) : null}
          {activeRow.is_enabled && !credentialsReady ? (
            <Text style={styles.warnText}>Enter required broker credentials to validate.</Text>
          ) : null}
          {activeRow.broker === 'dhan' ? (
            <Text style={styles.warnText}>
              Dhan allows maximum {DHAN_DAILY_CONSENT_LIMIT} consent logins per day. Reuse sessions when possible.
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.outlineBtn} onPress={onSave} disabled={busy}>
              <Text style={styles.outlineBtnText}>Save</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, !activeRow.is_enabled || !credentialsReady ? styles.btnDisabled : null]}
              onPress={onValidate}
              disabled={busy || !activeRow.is_enabled || !credentialsReady}>
              <Text style={styles.primaryBtnText}>Validate & Create Session</Text>
            </Pressable>
            <Pressable style={styles.outlineBtn} onPress={openDocs} disabled={busy}>
              <Text style={styles.outlineBtnText}>Open docs</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live positions</Text>
        {positions.length ? (
          positions.slice(0, 15).map((row, idx) => (
            <Text key={`pos-${idx}`} style={styles.line}>
              {positionLabel(row)} · qty {row?.netQty ?? row?.net_qty ?? row?.quantity ?? '—'} · LTP{' '}
              {row?.ltp ?? row?.last_price ?? '—'}
            </Text>
          ))
        ) : (
          <Text style={styles.placeholder}>
            {activeRow?.has_session
              ? 'No open positions found.'
              : `Validate ${BROKER_LABELS[selectedBroker] || selectedBroker} setup to load positions.`}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent orders</Text>
        {orders.length ? (
          orders.slice(0, 15).map((row, idx) => (
            <Text key={`ord-${idx}`} style={styles.line}>
              {orderLabel(row)} · {row?.transactionType || row?.side || '—'} ·{' '}
              {row?.orderStatus || row?.status || '—'}
            </Text>
          ))
        ) : (
          <Text style={styles.placeholder}>
            {activeRow?.has_session
              ? 'No recent orders found.'
              : 'Validate broker setup to load orders.'}
          </Text>
        )}
      </View>
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
    <ScreenScaffold title="Brokers" subtitle="Connect broker, validate session, view live positions">
      {content}
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  embeddedLoading: {alignItems: 'center', justifyContent: 'center', paddingVertical: 24},
  embeddedWrap: {flex: 1},
  embeddedContent: {gap: 10, paddingBottom: 16},
  card: {...mobileStyles.card, borderRadius: 12, padding: 12},
  cardTitle: mobileStyles.cardTitle,
  hint: mobileStyles.caption,
  label: mobileStyles.label,
  input: mobileStyles.input,
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AYC.cardBorder,
    backgroundColor: AYC.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipSelected: {backgroundColor: '#dbeafe', borderColor: '#3b82f6'},
  chipText: mobileStyles.chipText,
  chipTextSelected: {color: '#1d4ed8'},
  chipDot: {width: 8, height: 8, borderRadius: 99, backgroundColor: '#22c55e'},
  switchRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  switchLabel: mobileStyles.body,
  statusRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4},
  badge: {paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999},
  badgeOk: {backgroundColor: '#bbf7d0'},
  badgeLive: {backgroundColor: '#fecaca'},
  badgeMuted: {backgroundColor: '#e5e7eb'},
  badgeText: {fontSize: AYC.type.cardLabel, fontWeight: '800', color: AYC.text},
  meta: mobileStyles.muted,
  warnText: {fontSize: AYC.type.caption, color: '#b45309', lineHeight: 16},
  actions: {gap: 8, marginTop: 4},
  primaryBtn: mobileStyles.btnPrimary,
  primaryBtnText: mobileStyles.btnPrimaryText,
  outlineBtn: mobileStyles.btnOutline,
  outlineBtnText: mobileStyles.btnOutlineText,
  secondaryBtn: mobileStyles.btnSecondary,
  secondaryBtnText: mobileStyles.btnSecondaryText,
  btnDisabled: {opacity: 0.5},
  infoBanner: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  infoBannerText: {fontSize: AYC.type.caption, color: '#1e40af', fontWeight: '600'},
  successBox: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  successText: mobileStyles.success,
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: mobileStyles.err,
  line: mobileStyles.caption,
  placeholder: {...mobileStyles.muted, textAlign: 'center', paddingVertical: 8},
});
