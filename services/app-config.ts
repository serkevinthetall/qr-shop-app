import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/constants/api';

export type AppConfig = {
  min_version: string;
  min_ios_version: string;
  min_android_version: string;
  ios_store_url: string;
  android_store_url: string;
};

const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.qrshop.myanmar';

export function getInstalledAppVersion(): string {
  return (
    Constants.expoConfig?.version ||
    Constants.nativeAppVersion ||
    '0.0.0'
  );
}

export function getPlatformMinVersion(config: AppConfig): string {
  if (Platform.OS === 'ios') {
    return config.min_ios_version || config.min_version;
  }

  if (Platform.OS === 'android') {
    return config.min_android_version || config.min_version;
  }

  return config.min_version;
}

export function getStoreUrl(config: AppConfig): string {
  if (Platform.OS === 'ios') {
    return config.ios_store_url || '';
  }

  if (Platform.OS === 'android') {
    return config.android_store_url || DEFAULT_ANDROID_STORE;
  }

  return config.android_store_url || config.ios_store_url || '';
}

export async function fetchAppConfig(timeoutMs = 12000): Promise<AppConfig> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/api/app-config`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`App config HTTP ${response.status}`);
    }

    const data = (await response.json()) as Partial<AppConfig> & { success?: boolean };

    if (!data || data.success === false) {
      throw new Error('Invalid app config response');
    }

    return {
      min_version: String(data.min_version || '1.0.0'),
      min_ios_version: String(data.min_ios_version || data.min_version || '1.0.0'),
      min_android_version: String(data.min_android_version || data.min_version || '1.0.0'),
      ios_store_url: String(data.ios_store_url || ''),
      android_store_url: String(data.android_store_url || DEFAULT_ANDROID_STORE),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
