import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button, Linking, TextInput} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {JsonCard} from '@components/JsonCard';
import {brokersService} from '@core/api/services/brokersService';

export const BrokersScreen = () => {
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(null);
  const [dhanClientId, setDhanClientId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [options, currentSetup] = await Promise.all([
        brokersService.fetchBrokerOptions(),
        brokersService.fetchBrokerSetup(),
      ]);
      setSetup({options, currentSetup});
    } catch (error) {
      Alert.alert('Broker setup', String(error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const connectDhan = async () => {
    try {
      await brokersService.connectDhan({client_id: dhanClientId});
      await load();
    } catch (error) {
      Alert.alert('Connect Dhan failed', String(error?.message || error));
    }
  };

  const openBrokerCallbackTester = async () => {
    const deepLink = 'anistock://broker/callback?provider=dhan&status=success';
    await Linking.openURL(deepLink);
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{marginTop: 30}} />;
  }

  return (
    <ScreenScaffold title="Brokers" subtitle="Broker setup/session parity and deep-link callbacks">
      <TextInput
        value={dhanClientId}
        onChangeText={setDhanClientId}
        placeholder="Dhan Client ID"
        style={{borderWidth: 1, borderRadius: 8, padding: 10}}
      />
      <Button title="Connect Dhan" onPress={connectDhan} />
      <Button title="Test broker callback deep link" onPress={openBrokerCallbackTester} />
      <Button title="Refresh broker setup" onPress={load} />
      <JsonCard label="Broker Setup" value={setup} />
    </ScreenScaffold>
  );
};
