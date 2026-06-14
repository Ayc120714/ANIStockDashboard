import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@ani/mobile/dashboard-cache-v1';
const MAX_AGE_MS = 15 * 60 * 1000;

export async function readDashboardCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cached_at || Date.now() - parsed.cached_at > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeDashboardCache(payload) {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ...payload,
        cached_at: Date.now(),
      }),
    );
  } catch {
    /* ignore cache write failures */
  }
}
