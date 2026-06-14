import AsyncStorage from '@react-native-async-storage/async-storage';
import {v4 as uuidv4} from 'uuid';
import {STORAGE_KEYS} from '@core/storage/keys';

export async function getOrCreateDeviceId() {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.deviceId);
  if (existing) return existing;
  const generated = uuidv4();
  await AsyncStorage.setItem(STORAGE_KEYS.deviceId, generated);
  return generated;
}
