import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {JsonCard} from '@components/JsonCard';
import {marketsService} from '@core/api/services/marketsService';
import {runScreenPayloadFetch} from '@core/utils/screenPageLoader';

const MARKETS_CACHE_KEY = '@ani/mobile/page-cache/markets-fno-v1';

export const MarketsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState({});

  const load = useCallback(async ({forceRefresh = false} = {}) => {
    await runScreenPayloadFetch({
      cacheKey: MARKETS_CACHE_KEY,
      fetcher: async () => {
        const [fno, commodities, forex] = await Promise.all([
          marketsService.fetchFnoSummary(),
          marketsService.fetchCommoditiesSummary(),
          marketsService.fetchForexSummary(),
        ]);
        return {fno, commodities, forex};
      },
      applyPayload: setPayload,
      setLoading,
      setError: msg => {
        if (msg) Alert.alert('Markets', String(msg));
      },
      forceNetwork: forceRefresh,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <ActivityIndicator style={{marginTop: 30}} />;
  }

  return (
    <ScreenScaffold title="Markets" subtitle="FnO, commodities, and forex module parity">
      <Button title="Refresh markets" onPress={() => load({forceRefresh: true})} />
      <JsonCard label="Market Modules" value={payload} />
    </ScreenScaffold>
  );
};
