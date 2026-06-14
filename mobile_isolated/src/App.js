import React from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context';
import {enableScreens} from 'react-native-screens';
import {AuthProvider} from '@core/auth/AuthContext';
import {AppNavigator} from '@nav/AppNavigator';
import {AppErrorBoundary} from '@components/AppErrorBoundary';

// Native stack navigators require native screens; disabling them causes a blank screen on Android.
enableScreens(true);

const App = () => (
  <AppErrorBoundary>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar barStyle="light-content" backgroundColor="#060b19" translucent={false} />
      <AuthProvider>
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  </AppErrorBoundary>
);

export default App;
