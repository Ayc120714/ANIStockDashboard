import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from '@core/auth/AuthContext';
import {AppNavigator} from '@nav/AppNavigator';

const App = () => (
  <SafeAreaProvider>
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  </SafeAreaProvider>
);

export default App;
