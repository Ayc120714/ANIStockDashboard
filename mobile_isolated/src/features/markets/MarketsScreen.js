import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Button, RefreshControl, ScrollView} from 'react-native';
import {ScreenScaffold} from '@components/ScreenScaffold';
import {JsonCard} from '@components/JsonCard';
import {marketsService} from '@core/api/services/marketsService';
import {runScreenPayloadFetch} from '@core/utils/screenPageLoader';
import {MOBILE_PAGE_CACHE_KEYS} from '@core/utils/dashboardCachePolicy';

export const MarketsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payload, setPayload] = useState({});

  const load = useCallback(async ({forceRefresh = false} = {}) => {
    await runScreenPayloadFetch({
      cacheKey: MOBILE_PAGE_CACHE_KEYS.marketsFno,
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({forceRefresh: true});
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <ActivityIndicator style={{marginTop: 30}} />;
  }

  return (
    <ScreenScaffold title="Markets" subtitle="FnO, commodities, and forex module parity">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Button title="Refresh markets" onPress={() => load({forceRefresh: true})} />
        <JsonCard label="Market Modules" value={payload} />
      </ScrollView>
    </ScreenScaffold>
  );
};
