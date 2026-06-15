import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {BottomTabBar} from '@react-navigation/bottom-tabs';
import {AppShellBanner} from '@components/AppShellBanner';
import {useAuth} from '@core/auth/AuthContext';
import {useSetupAlerts} from '@core/context/SetupAlertsContext';
import {authService} from '@core/api/services/authService';
import {extractApiRows} from '@core/utils/apiPayload';
import {ensureNotificationPermission, showSystemNotification, consumePendingEntryHint} from '@core/utils/signalNotifications';
import {STORAGE_KEYS} from '@core/storage/keys';
import {DashboardScreen} from '@features/dashboard/DashboardScreen';
import {StocksHubScreen} from '@features/stocks/StocksHubScreen';
import {ScreensHubScreen} from '@features/screens/ScreensHubScreen';
import {SignalsScreen} from '@features/signals/SignalsScreen';
import {AdvisorHubScreen} from '@features/advisor/AdvisorHubScreen';

const Tab = createBottomTabNavigator();

const ADMIN_POLL_MS = 90_000;

function pendingApprovalDigest(users) {
  return (users || [])
    .filter(r => r?.is_pending_approval)
    .map(r => `${r.id}:${String(r.email || '').toLowerCase()}`)
    .sort()
    .join('|');
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
  const {user} = useAuth();
  const isSuperAdmin = Boolean(user?.is_super_admin);
  const {
    entryHint: setupEntryHint,
    signalsBadge,
    clearEntryHint,
    clearSignalsBadge,
  } = useSetupAlerts();
  const [entryHint, setEntryHint] = useState('');
  const [adminHint, setAdminHint] = useState('');
  const firstAdminPoll = useRef(true);

  const bannerHint = setupEntryHint || entryHint;

  const refreshAdmin = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const adminRes = await authService.fetchAdminUsers(true).catch(() => null);
      const adminUsers = extractApiRows(adminRes, ['data', 'users']);
      const pending = adminUsers.filter(r => r?.is_pending_approval);
      const pendingDigest = pendingApprovalDigest(adminUsers);
      const prevPending = await AsyncStorage.getItem(STORAGE_KEYS.pendingApprovalDigest);
      const prevCount = prevPending ? prevPending.split('|').filter(Boolean).length : 0;
      if (
        !firstAdminPoll.current
        && prevPending != null
        && pendingDigest !== prevPending
        && pending.length > prevCount
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
    } catch {
      /* ignore */
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    ensureNotificationPermission().catch(() => {});
    const bootTimer = setTimeout(refreshAdmin, 5000);
    const t = setInterval(refreshAdmin, ADMIN_POLL_MS);
    return () => {
      clearTimeout(bootTimer);
      clearInterval(t);
    };
  }, [refreshAdmin]);

  useEffect(() => {
    const applyPendingHint = async () => {
      const hint = await consumePendingEntryHint();
      if (hint) {
        setEntryHint(hint);
      }
    };
    applyPendingHint();
    const t = setInterval(applyPendingHint, 2000);
    return () => clearInterval(t);
  }, []);

  const onOpenSignals = useCallback(() => {
    navigation?.navigate('MainTabs', {screen: 'Signals'});
    clearEntryHint();
    setEntryHint('');
    clearSignalsBadge();
  }, [clearEntryHint, clearSignalsBadge, navigation]);

  const onDismissEntry = useCallback(() => {
    clearEntryHint();
    setEntryHint('');
  }, [clearEntryHint]);

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
            entryHint={bannerHint}
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
            clearSignalsBadge();
            clearEntryHint();
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
