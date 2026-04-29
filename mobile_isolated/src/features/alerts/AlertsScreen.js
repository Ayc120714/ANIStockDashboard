import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button, TextInput} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {JsonCard} from '@components/JsonCard';
import {alertsService} from '@core/api/services/alertsService';
import {useAuth} from '@core/auth/AuthContext';

export const AlertsScreen = () => {
  const {user} = useAuth();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [symbol, setSymbol] = useState('NSE:SBIN');
  const [price, setPrice] = useState('900');

  const load = async () => {
    setLoading(true);
    try {
      const list = await alertsService.fetchPriceAlerts();
      setAlerts(Array.isArray(list) ? list : list?.data || []);
    } catch (error) {
      Alert.alert('Alerts', String(error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const createAlert = async () => {
    try {
      await alertsService.createPriceAlert({
        user_id: user?.id,
        symbol,
        threshold_price: Number(price),
        direction: 'above',
        is_active: true,
      });
      await load();
    } catch (error) {
      Alert.alert('Create alert failed', String(error?.message || error));
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{marginTop: 30}} />;
  }

  return (
    <ScreenScaffold title="Alerts" subtitle="Price + advisor alerts parity">
      <TextInput value={symbol} onChangeText={setSymbol} placeholder="Symbol" style={{borderWidth: 1, borderRadius: 8, padding: 10}} />
      <TextInput value={price} onChangeText={setPrice} placeholder="Threshold price" keyboardType="decimal-pad" style={{borderWidth: 1, borderRadius: 8, padding: 10}} />
      <Button title="Create sample alert" onPress={createAlert} />
      <Button title="Refresh alerts" onPress={load} />
      <JsonCard label="Alerts" value={alerts} />
    </ScreenScaffold>
  );
};
