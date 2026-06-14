import AsyncStorage from '@react-native-async-storage/async-storage';
import {extractApiRows} from '@core/utils/apiPayload';

const CACHE_KEY = 'advisor_signals_payload_v1';

export async function readAdvisorSignalsCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return extractApiRows(parsed);
  } catch {
    return [];
  }
}

export async function writeAdvisorSignalsCache(rows) {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({data: Array.isArray(rows) ? rows : [], cached_at: Date.now()}),
    );
  } catch {
    /* ignore cache write failures */
  }
}
