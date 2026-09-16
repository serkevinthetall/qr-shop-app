import AsyncStorage from '@react-native-async-storage/async-storage';

const primary = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
const fallback = process.env.EXPO_PUBLIC_API_FALLBACK_URL?.replace(/\/$/, '') || '';

if (!primary) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_BASE_URL. Copy .env.example to .env and set your API URL.',
  );
}

/** Primary API (Vercel / www.qrshop.online). */
export const API_BASE_URL = primary;

/** Secondary API (Netlify). Empty when unset. */
export const API_FALLBACK_URL = fallback;

const PREFERRED_API_BASE_KEY = 'qrshop.preferredApiBase';

/** How long to wait on a failing host before trying the next (ms). */
export const API_FAILOVER_PROBE_MS = 4000;

let preferredBaseUrl = API_BASE_URL;
let hydratePromise: Promise<void> | null = null;

function isKnownBase(url: string) {
  return url === API_BASE_URL || (API_FALLBACK_URL && url === API_FALLBACK_URL);
}

export function getApiBaseUrl() {
  return preferredBaseUrl;
}

/** Ordered unique bases: last success first, then primary, then fallback. */
export function getApiBaseCandidates() {
  const list = [preferredBaseUrl, API_BASE_URL, API_FALLBACK_URL].filter(Boolean);
  return [...new Set(list)];
}

export function noteApiBaseSuccess(baseUrl: string) {
  const next = baseUrl.replace(/\/$/, '');
  if (!next || !isKnownBase(next)) {
    return;
  }

  preferredBaseUrl = next;
  void AsyncStorage.setItem(PREFERRED_API_BASE_KEY, next).catch(() => undefined);
}

/** Restore last working API host (avoids waiting on dead primary every cold start). */
export function hydratePreferredApiBase() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const stored = String((await AsyncStorage.getItem(PREFERRED_API_BASE_KEY)) || '').replace(
          /\/$/,
          '',
        );
        if (stored && isKnownBase(stored)) {
          preferredBaseUrl = stored;
        }
      } catch {
        // keep default primary
      }
    })();
  }

  return hydratePromise;
}

/**
 * Full timeout on the preferred/last host; short probe when we still have
 * another candidate to fail over to.
 */
export function timeoutForApiBase(baseUrl: string, fullTimeoutMs: number, remainingBases: number) {
  if (remainingBases <= 1) {
    return fullTimeoutMs;
  }

  if (baseUrl === preferredBaseUrl) {
    return Math.min(fullTimeoutMs, Math.max(API_FAILOVER_PROBE_MS * 2, 8000));
  }

  return Math.min(fullTimeoutMs, API_FAILOVER_PROBE_MS);
}

export const PAYMENT_CONFIG = {
  merchantName: 'QR Shop',
  kpayPhone: '09420103001',
};
