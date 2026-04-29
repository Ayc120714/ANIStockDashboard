import AsyncStorage from '@react-native-async-storage/async-storage';
import {STORAGE_KEYS} from './keys';

export const tokenStorage = {
  async getAccessToken() {
    return AsyncStorage.getItem(STORAGE_KEYS.accessToken);
  },
  async getRefreshToken() {
    return AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
  },
  async saveTokens({accessToken, refreshToken}) {
    const updates = [];
    if (accessToken) {
      updates.push([STORAGE_KEYS.accessToken, accessToken]);
    }
    if (refreshToken) {
      updates.push([STORAGE_KEYS.refreshToken, refreshToken]);
    }
    if (updates.length) {
      await AsyncStorage.multiSet(updates);
    }
  },
  async clearTokens() {
    await AsyncStorage.multiRemove([STORAGE_KEYS.accessToken, STORAGE_KEYS.refreshToken]);
  },
};
