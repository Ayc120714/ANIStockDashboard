import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {JsonCard} from '@components/JsonCard';
import {marketsService} from '@core/api/services/marketsService';

export const MarketsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [fno, commodities, forex] = await Promise.all([
        marketsService.fetchFnoSummary(),
        marketsService.fetchCommoditiesSummary(),
        marketsService.fetchForexSummary(),
      ]);
      setPayload({fno, commodities, forex});
    } catch (error) {
      Alert.alert('Markets', String(error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{marginTop: 30}} />;
  }

  return (
    <ScreenScaffold title="Markets" subtitle="FnO, commodities, and forex module parity">
      <Button title="Refresh markets" onPress={load} />
      <JsonCard label="Market Modules" value={payload} />
    </ScreenScaffold>
  );
};
