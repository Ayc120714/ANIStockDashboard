import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Button, Text} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {JsonCard} from '@components/JsonCard';
import {dashboardService} from '@core/api/services/dashboardService';
import {useAuth} from '@core/auth/AuthContext';

export const DashboardScreen = ({navigation}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});
  const {logout, user} = useAuth();

  const loadData = async () => {
    setLoading(true);
    try {
      const [indices, watchlist, alerts, status] = await Promise.all([
        dashboardService.fetchMarketIndices(),
        dashboardService.fetchWatchlist(),
        dashboardService.fetchAdvisorAlerts(),
        dashboardService.fetchSystemStatus(),
      ]);
      setData({indices, watchlist, alerts, status});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{marginTop: 30}} />;
  }

  return (
    <ScreenScaffold title="Dashboard" subtitle={`Welcome ${user?.name || user?.email || 'User'}`}>
      <Button title="Refresh" onPress={loadData} />
      <Button title="Orders" onPress={() => navigation.navigate('Orders')} />
      <Button title="Brokers" onPress={() => navigation.navigate('Brokers')} />
      <Button title="Alerts" onPress={() => navigation.navigate('Alerts')} />
      <Button title="Markets" onPress={() => navigation.navigate('Markets')} />
      {(user?.is_admin || user?.is_super_admin) && <Button title="Admin" onPress={() => navigation.navigate('Admin')} />}
      <Button title="Logout" onPress={logout} />
      <Text>Core parity payloads</Text>
      <JsonCard label="Market Indices" value={data.indices} />
      <JsonCard label="Watchlist" value={data.watchlist} />
      <JsonCard label="Advisor Alerts" value={data.alerts} />
      <JsonCard label="System Status" value={data.status} />
    </ScreenScaffold>
  );
};
