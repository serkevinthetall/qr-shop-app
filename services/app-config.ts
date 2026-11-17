import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  getApiBaseCandidates,
  hydratePreferredApiBase,
  noteApiBaseSuccess,
  timeoutForApiBase,
} from '@/constants/api';
import { warmCloudflareDoh } from '@/services/cloudflare-doh';

export type AppConfig = {
  /** Backend shop pause — polled; flip on API without a new app build. */
  maintenance: boolean;
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

function isRetriableNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'AbortError' ||
    error.message === 'Network request failed' ||
    error.message.includes('Network Error') ||
    error.message.includes('Failed to fetch')
  );
}

export async function fetchAppConfig(timeoutMs = 45000): Promise<AppConfig> {
  await hydratePreferredApiBase();

  const bases = getApiBaseCandidates();
  let lastError: unknown;

  for (let i = 0; i < bases.length; i += 1) {
    const baseUrl = bases[i];
    const remaining = bases.length - i;
    const attemptTimeout = timeoutForApiBase(baseUrl, timeoutMs, remaining);

    if (Platform.OS === 'android') {
      try {
        await warmCloudflareDoh(new URL(baseUrl).hostname).catch(() => undefined);
      } catch {
        // ignore invalid URL
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptTimeout);

    try {
      const response = await fetch(`${baseUrl}/api/app-config`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      // Host without /api/app-config yet (Platform 404) — don't block the app.
      if (response.status === 404) {
        noteApiBaseSuccess(baseUrl);
        return {
          maintenance: false,
          min_version: '1.0.0',
          min_ios_version: '1.0.0',
          min_android_version: '1.0.0',
          ios_store_url: '',
          android_store_url: DEFAULT_ANDROID_STORE,
        };
      }

      if (!response.ok) {
        throw new Error(`App config HTTP ${response.status}`);
      }

      const json = (await response.json()) as Partial<AppConfig> & {
        ok?: boolean;
        success?: boolean;
        data?: Partial<AppConfig> & { maintenance?: boolean | string | number };
        maintenance?: boolean | string | number;
        error?: { message?: string };
      };

      // Some hosts return 200 with { ok:false, error: Not found }.
      const notFoundMessage = String(json?.error?.message || '');
      if (
        json?.ok === false &&
        /not\s*found/i.test(notFoundMessage)
      ) {
        noteApiBaseSuccess(baseUrl);
        return {
          maintenance: false,
          min_version: '1.0.0',
          min_ios_version: '1.0.0',
          min_android_version: '1.0.0',
          ios_store_url: '',
          android_store_url: DEFAULT_ANDROID_STORE,
        };
      }

      if (!json || json.success === false || json.ok === false) {
        throw new Error('Invalid app config response');
      }

      // Platform API: { ok: true, data: {...} } — also accept flat legacy payloads.
      const data =
        json.data && typeof json.data === 'object'
          ? { ...json, ...json.data }
          : json;

      noteApiBaseSuccess(baseUrl);

      const maintenanceRaw = data.maintenance;
      const maintenance =
        maintenanceRaw === true ||
        Number(maintenanceRaw) === 1 ||
        String(maintenanceRaw ?? '')
          .trim()
          .toLowerCase() === 'true' ||
        String(maintenanceRaw ?? '')
          .trim()
          .toLowerCase() === '1' ||
        String(maintenanceRaw ?? '')
          .trim()
          .toLowerCase() === 'yes';

      return {
        maintenance,
        min_version: String(data.min_version || '1.0.0'),
        min_ios_version: String(data.min_ios_version || data.min_version || '1.0.0'),
        min_android_version: String(data.min_android_version || data.min_version || '1.0.0'),
        ios_store_url: String(data.ios_store_url || ''),
        android_store_url: String(data.android_store_url || DEFAULT_ANDROID_STORE),
      };
    } catch (error) {
      lastError = error;
      if (!isRetriableNetworkError(error)) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('App config request failed');
}
