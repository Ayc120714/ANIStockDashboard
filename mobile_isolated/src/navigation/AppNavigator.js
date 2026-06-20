import React, {useEffect, useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '@core/auth/AuthContext';
import {AycSplashScreen} from '@components/AycSplashScreen';
import {AppStartupLoader} from '@components/AppStartupLoader';
import {LoginScreen} from '@features/auth/LoginScreen';
import {OtpVerifyScreen} from '@features/auth/OtpVerifyScreen';
import {AdminScreen} from '@features/admin/AdminScreen';
import {WebPortalScreen} from '@features/web/WebPortalScreen';
import {useBrokerDeepLinking} from '@features/brokers/useBrokerDeepLinking';
import {MainTabNavigator} from '@nav/MainTabNavigator';
import {RedirectToStocksTab} from '@nav/RedirectToStocksTab';
import {SignalsScreen} from '@features/signals/SignalsScreen';
import {AlertsScreen} from '@features/alerts/AlertsScreen';
import {MarketsHomeScreen} from '@features/markets/MarketsHomeScreen';
import {WatchlistScreen} from '@features/stocks/WatchlistScreen';
import {PortfolioHubScreen} from '@features/portfolio/PortfolioHubScreen';
import {MutualFundsScreen} from '@features/markets/MutualFundsScreen';
import {useAppUpdatePrompt} from '@hooks/useAppUpdatePrompt';
import {SetupAlertsProvider} from '@core/context/SetupAlertsContext';

const Stack = createNativeStackNavigator();

export const AppNavigator = () => {
  const {isBootstrapping, isAuthenticated, user} = useAuth();
  const [appDataReady, setAppDataReady] = useState(false);
  useBrokerDeepLinking();
  useAppUpdatePrompt({enabled: isAuthenticated && appDataReady});

  useEffect(() => {
    if (!isAuthenticated) {
      setAppDataReady(false);
    }
  }, [isAuthenticated]);

  if (isBootstrapping) {
    return <AycSplashScreen />;
  }

  if (isAuthenticated && !appDataReady) {
    return <AppStartupLoader onReady={() => setAppDataReady(true)} />;
  }

  return (
    <SetupAlertsProvider enabled={isAuthenticated && appDataReady}>
      <NavigationContainer key={isAuthenticated ? 'app' : 'login'}>
      {!isAuthenticated ? (
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{headerShown: false}} />
          <Stack.Screen name="Signals" component={SignalsScreen} options={{headerShown: false}} />
          <Stack.Screen name="Markets" component={MarketsHomeScreen} options={{headerShown: false}} />
          <Stack.Screen
            name="Watchlist"
            component={WatchlistScreen}
            options={{headerShown: false}}
          />
          <Stack.Screen name="Portfolio" component={PortfolioHubScreen} options={{headerShown: false}} />
          <Stack.Screen name="MutualFunds" component={MutualFundsScreen} options={{headerShown: false}} />
          <Stack.Screen name="Orders" options={{headerShown: false}}>
            {props => <RedirectToStocksTab {...props} outlookTab="orders" />}
          </Stack.Screen>
          <Stack.Screen name="Brokers" options={{headerShown: false}}>
            {props => <RedirectToStocksTab {...props} outlookTab="brokers" />}
          </Stack.Screen>
          <Stack.Screen name="Alerts" component={AlertsScreen} options={{headerShown: false}} />
          <Stack.Screen name="WebPortal" component={WebPortalScreen} options={{headerShown: true}} />
          {user?.is_super_admin ? <Stack.Screen name="Admin" component={AdminScreen} options={{title: 'Admin'}} /> : null}
        </Stack.Navigator>
      )}
      </NavigationContainer>
    </SetupAlertsProvider>
  );
};
