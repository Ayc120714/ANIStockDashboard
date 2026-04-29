import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button, TextInput} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {JsonCard} from '@components/JsonCard';
import {authService} from '@core/api/services/authService';

export const AdminScreen = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [premiumEmail, setPremiumEmail] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await authService.fetchAdminUsers(true);
      setUsers(Array.isArray(data) ? data : data?.users || data?.data || []);
    } catch (error) {
      Alert.alert('Admin', String(error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const addPremium = async () => {
    try {
      await authService.addPremiumEmail(premiumEmail);
      setPremiumEmail('');
      Alert.alert('Done', 'Premium email added');
    } catch (error) {
      Alert.alert('Add premium failed', String(error?.message || error));
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{marginTop: 30}} />;
  }

  return (
    <ScreenScaffold title="Admin" subtitle="Admin users and premium management parity">
      <TextInput
        value={premiumEmail}
        onChangeText={setPremiumEmail}
        placeholder="Premium email"
        autoCapitalize="none"
        style={{borderWidth: 1, borderRadius: 8, padding: 10}}
      />
      <Button title="Add premium email" onPress={addPremium} />
      <Button title="Refresh admin users" onPress={load} />
      <JsonCard label="Admin Users" value={users} />
    </ScreenScaffold>
  );
};
