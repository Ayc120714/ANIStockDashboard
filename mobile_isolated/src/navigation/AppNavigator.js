import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ActivityIndicator, View} from 'react-native';
import {useAuth} from '@core/auth/AuthContext';
import {LoginScreen} from '@features/auth/LoginScreen';
import {OtpVerifyScreen} from '@features/auth/OtpVerifyScreen';
import {OrdersScreen} from '@features/orders/OrdersScreen';
import {BrokersScreen} from '@features/brokers/BrokersScreen';
import {AlertsScreen} from '@features/alerts/AlertsScreen';
import {AdminScreen} from '@features/admin/AdminScreen';
import {WebPortalScreen} from '@features/web/WebPortalScreen';
import {useBrokerDeepLinking} from '@features/brokers/useBrokerDeepLinking';
import {MainTabNavigator} from '@nav/MainTabNavigator';
import {SignalsScreen} from '@features/signals/SignalsScreen';
import {MarketsHomeScreen} from '@features/markets/MarketsHomeScreen';
import {WatchlistScreen} from '@features/stocks/WatchlistScreen';
import {PortfolioHubScreen} from '@features/portfolio/PortfolioHubScreen';
import {MutualFundsScreen} from '@features/markets/MutualFundsScreen';

const Stack = createNativeStackNavigator();

const LoadingScreen = () => (
  <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6'}}>
    <ActivityIndicator size="large" color="#2563eb" />
  </View>
);

export const AppNavigator = () => {
  const {isBootstrapping, isAuthenticated, user} = useAuth();
  useBrokerDeepLinking();

  if (isBootstrapping) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {!isAuthenticated ? (
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{headerShown: false}} />
          <Stack.Screen name="Signals" component={SignalsScreen} options={{headerShown: false}} />
          <Stack.Screen name="Markets" component={MarketsHomeScreen} options={{title: 'Markets'}} />
          <Stack.Screen
            name="Watchlist"
            component={WatchlistScreen}
            options={({route}) => ({title: route.params?.title || 'Watchlist'})}
          />
          <Stack.Screen name="Portfolio" component={PortfolioHubScreen} options={{title: 'Portfolio'}} />
          <Stack.Screen name="MutualFunds" component={MutualFundsScreen} options={{title: 'Mutual Funds'}} />
          <Stack.Screen name="Orders" component={OrdersScreen} options={{title: 'Orders'}} />
          <Stack.Screen name="Brokers" component={BrokersScreen} options={{title: 'Brokers'}} />
          <Stack.Screen name="Alerts" component={AlertsScreen} options={{title: 'Alerts'}} />
          <Stack.Screen name="WebPortal" component={WebPortalScreen} options={{headerShown: true}} />
          {user?.is_super_admin ? <Stack.Screen name="Admin" component={AdminScreen} options={{title: 'Admin'}} /> : null}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};
