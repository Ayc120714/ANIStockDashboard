import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {BottomTabBar} from '@react-navigation/bottom-tabs';
import {AppShellBanner} from '@components/AppShellBanner';
import {useAuth} from '@core/auth/AuthContext';
import {authService} from '@core/api/services/authService';
import {signalsService} from '@core/api/services/signalsService';
import {API_TIMEOUT_MS} from '@core/config/apiTimeouts';
import {extractApiRows} from '@core/utils/apiPayload';
import {diffNewSignals, signalsDigest} from '@core/utils/signalsDigest';
import {buildSignalNotificationPayload} from '@core/utils/signalNotificationCopy';
import {ensureNotificationPermission, notifyNewSignals, showSystemNotification, consumePendingEntryHint} from '@core/utils/signalNotifications';
import {STORAGE_KEYS} from '@core/storage/keys';
import {DashboardScreen} from '@features/dashboard/DashboardScreen';
import {StocksHubScreen} from '@features/stocks/StocksHubScreen';
import {ScreensHubScreen} from '@features/screens/ScreensHubScreen';
import {SignalsScreen} from '@features/signals/SignalsScreen';
import {AdvisorHubScreen} from '@features/advisor/AdvisorHubScreen';

const Tab = createBottomTabNavigator();

const POLL_MS = 75_000;

function pendingApprovalDigest(users) {
  return (users || [])
    .filter(r => r?.is_pending_approval)
    .map(r => `${r.id}:${String(r.email || '').toLowerCase()}`)
    .sort()
    .join('|');
}

function entryDigest(data) {
  const list = (data || []).filter(r => String(r.status) === 'entry_ready');
  return list.map(r => `${r.symbol}:${Number(r.entry_price || 0).toFixed(2)}`).sort().join('|');
}

function TabIcon({emoji, focused}) {
  return (
    <View style={{alignItems: 'center', justifyContent: 'center'}}>
      <Text style={{fontSize: 20, opacity: focused ? 1 : 0.55}}>{emoji}</Text>
    </View>
  );
}

/** Use stack `navigation` prop — `useNavigation()` can throw when this navigator mounts as a stack screen. */
export function MainTabNavigator({navigation}) {
  const insets = useSafeAreaInsets();
  const {user, isAuthenticated} = useAuth();
  const isSuperAdmin = Boolean(user?.is_super_admin);
  const [entryHint, setEntryHint] = useState('');
  const [adminHint, setAdminHint] = useState('');
  const [signalsBadge, setSignalsBadge] = useState(undefined);
  const firstPoll = useRef(true);
  const firstAdminPoll = useRef(true);

  const refreshShell = useCallback(async () => {
    if (AppState.currentState !== 'active') {
      return;
    }
    try {
      const adminPromise = isSuperAdmin
        ? authService.fetchAdminUsers(true).catch(() => null)
        : Promise.resolve(null);
      const [sigRes, adminRes] = await Promise.all([
        signalsService.fetchLatestSignals({limit: 40, timeoutMs: API_TIMEOUT_MS.advisor}).catch(() => null),
        adminPromise,
      ]);

      const data = Array.isArray(sigRes) ? sigRes : extractApiRows(sigRes);
      const digest = signalsDigest(data);
      const prev =
        (await AsyncStorage.getItem(STORAGE_KEYS.signalsDigest)) ??
        (await AsyncStorage.getItem(STORAGE_KEYS.entryReadyDigest));
      if (!firstPoll.current && prev != null && digest !== prev) {
        const fresh = diffNewSignals(prev, data);
        if (fresh.length) {
          const payload = buildSignalNotificationPayload(fresh);
          if (payload) {
            setEntryHint(payload.entryHint);
            setSignalsBadge(fresh.length > 99 ? '99+' : fresh.length);
            await notifyNewSignals(fresh, {vibrateInApp: true});
          }
        }
      }
      await AsyncStorage.setItem(STORAGE_KEYS.signalsDigest, digest);
      await AsyncStorage.setItem(STORAGE_KEYS.entryReadyDigest, entryDigest(data));
      firstPoll.current = false;

      if (isSuperAdmin) {
        const adminUsers = extractApiRows(adminRes, ['data', 'users']);
        const pending = adminUsers.filter(r => r?.is_pending_approval);
        const pendingDigest = pendingApprovalDigest(adminUsers);
        const prevPending = await AsyncStorage.getItem(STORAGE_KEYS.pendingApprovalDigest);
        const prevCount = prevPending ? prevPending.split('|').filter(Boolean).length : 0;
        if (
          !firstAdminPoll.current &&
          prevPending != null &&
          pendingDigest !== prevPending &&
          pending.length > prevCount
        ) {
          const names = pending
            .slice(0, 3)
            .map(r => r.email || r.full_name || `User ${r.id}`)
            .join(', ');
          setAdminHint(
            pending.length
              ? `New registration pending approval${names ? `: ${names}` : ''}. Review in Admin.`
              : 'Registration queue updated. Review pending users in Admin.',
          );
          await showSystemNotification(
            'Registration pending',
            names || 'A new user is waiting for approval.',
          );
        }
        await AsyncStorage.setItem(STORAGE_KEYS.pendingApprovalDigest, pendingDigest);
        firstAdminPoll.current = false;
      }
    } catch {
      /* ignore transient network errors */
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    ensureNotificationPermission().catch(() => {});
    const bootTimer = setTimeout(refreshShell, 4000);
    const t = setInterval(refreshShell, POLL_MS);
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        refreshShell();
      }
    });
    return () => {
      clearTimeout(bootTimer);
      clearInterval(t);
      sub.remove();
    };
  }, [refreshShell]);

  useEffect(() => {
    const applyPendingHint = async () => {
      const hint = await consumePendingEntryHint();
      if (hint) {
        setEntryHint(hint);
        setSignalsBadge('1');
      }
    };
    applyPendingHint();
    const t = setInterval(applyPendingHint, 2000);
    return () => clearInterval(t);
  }, []);

  const onOpenSignals = useCallback(() => {
    navigation?.navigate('MainTabs', {screen: 'Signals'});
    setEntryHint('');
    setSignalsBadge(undefined);
  }, [navigation]);

  const onDismissEntry = useCallback(() => setEntryHint(''), []);

  const onOpenAdmin = useCallback(() => {
    navigation?.navigate('Admin');
    setAdminHint('');
  }, [navigation]);

  const onDismissAdmin = useCallback(() => setAdminHint(''), []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarActiveTintColor: '#0d1b4b',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: {fontSize: 11, fontWeight: '700'},
      }}
      tabBar={props => (
        <View>
          <AppShellBanner
            entryHint={entryHint}
            adminHint={adminHint}
            onOpenSignals={onOpenSignals}
            onDismissEntry={onDismissEntry}
            onOpenAdmin={onOpenAdmin}
            onDismissAdmin={onDismissAdmin}
          />
          <View style={{paddingBottom: insets.bottom}}>
            <BottomTabBar {...props} />
          </View>
        </View>
      )}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({focused}) => <TabIcon emoji="▣" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Stocks"
        component={StocksHubScreen}
        options={{
          tabBarLabel: 'Stocks',
          tabBarIcon: ({focused}) => <TabIcon emoji="◎" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Signals"
        component={SignalsScreen}
        listeners={{
          tabPress: () => {
            setSignalsBadge(undefined);
            setEntryHint('');
          },
        }}
        options={{
          tabBarLabel: 'Signals',
          tabBarBadge: signalsBadge,
          tabBarIcon: ({focused}) => <TabIcon emoji="⚡" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Screens"
        component={ScreensHubScreen}
        options={{
          tabBarLabel: 'Screens',
          tabBarIcon: ({focused}) => <TabIcon emoji="▤" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Advisor"
        component={AdvisorHubScreen}
        options={{
          tabBarLabel: 'Advisor',
          tabBarIcon: ({focused}) => <TabIcon emoji="✦" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
