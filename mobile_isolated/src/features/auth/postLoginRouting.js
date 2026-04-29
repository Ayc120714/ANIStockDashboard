import AsyncStorage from '@react-native-async-storage/async-storage';
import {brokersService} from '@core/api/services/brokersService';

const CONSENT_PREFIX = '@ani/mobile/dhan_consent_blocked_';

const todayKey = userId => `${CONSENT_PREFIX}${String(userId || '')}_${new Date().toISOString().slice(0, 10)}`;

export const shouldSkipBrokerConsentToday = async userId =>
  (await AsyncStorage.getItem(todayKey(userId))) === '1';

export const markConsentLimitForToday = async userId => AsyncStorage.setItem(todayKey(userId), '1');

export const hasAnyBrokerLiveSession = rows =>
  Boolean((Array.isArray(rows) ? rows : []).find(row => row?.live_session || row?.is_connected || row?.token_stored));

export const resolvePostLoginRoute = async ({nextUser}) => {
  const userId = String(nextUser?.id || nextUser?.user_id || nextUser?.email || '');
  if (!userId) return {screen: 'Dashboard'};

  if (await shouldSkipBrokerConsentToday(userId)) {
    return {screen: 'Dashboard', params: {brokerConsentLimited: true}};
  }

  try {
    const setup = await brokersService.fetchBrokerSetup();
    if (hasAnyBrokerLiveSession(setup)) {
      return {screen: 'Dashboard'};
    }
  } catch (_) {
    return {screen: 'Dashboard'};
  }

  if (!nextUser?.is_admin && !nextUser?.is_super_admin) {
    return {screen: 'Brokers', params: {openBrokerSetup: true}};
  }
  return {screen: 'Dashboard'};
};
