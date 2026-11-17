import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * SecureStore works on iOS/Android; on web it is unavailable / unreliable.
 * Use AsyncStorage on web so login sessions and saved passwords persist.
 */
const useSecureStore = Platform.OS !== 'web';

export async function kvGet(key: string): Promise<string | null> {
  try {
    if (useSecureStore) {
      return await SecureStore.getItemAsync(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    if (useSecureStore) {
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function kvDelete(key: string): Promise<void> {
  try {
    if (useSecureStore) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  }
}
