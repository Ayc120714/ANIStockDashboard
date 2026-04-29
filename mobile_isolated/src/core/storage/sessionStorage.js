import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from './keys';

export const sessionStorage = {
  async getUser() {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.user);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  },
  async saveUser(user) {
    if (!user) {
      await AsyncStorage.removeItem(STORAGE_KEYS.user);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  },
  async clear() {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.user,
      STORAGE_KEYS.otpFlow,
      STORAGE_KEYS.accessToken,
      STORAGE_KEYS.refreshToken,
    ]);
  },
};
