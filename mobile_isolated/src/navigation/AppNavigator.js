import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ActivityIndicator, View} from 'react-native';
import {useAuth} from '@core/auth/AuthContext';
import {LoginScreen} from '@features/auth/LoginScreen';
import {OtpVerifyScreen} from '@features/auth/OtpVerifyScreen';
import {DashboardScreen} from '@features/dashboard/DashboardScreen';
import {OrdersScreen} from '@features/orders/OrdersScreen';
import {BrokersScreen} from '@features/brokers/BrokersScreen';
import {AlertsScreen} from '@features/alerts/AlertsScreen';
import {MarketsScreen} from '@features/markets/MarketsScreen';
import {AdminScreen} from '@features/admin/AdminScreen';
import {useBrokerDeepLinking} from '@features/brokers/useBrokerDeepLinking';

const Stack = createNativeStackNavigator();

const LoadingScreen = () => (
  <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
    <ActivityIndicator size="large" />
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
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Orders" component={OrdersScreen} />
          <Stack.Screen name="Brokers" component={BrokersScreen} />
          <Stack.Screen name="Alerts" component={AlertsScreen} />
          <Stack.Screen name="Markets" component={MarketsScreen} />
          {(user?.is_super_admin || user?.is_admin) && <Stack.Screen name="Admin" component={AdminScreen} />}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};
