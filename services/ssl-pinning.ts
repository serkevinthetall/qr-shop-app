import { Platform } from 'react-native';
import {
  initializeSslPinning,
  isSslPinningAvailable,
} from 'react-native-ssl-public-key-pinning';

/**
 * SPKI (SHA-256) pins for API hosts — leaf + intermediate.
 * Keep in sync with plugins/okhttp-doh/DohOkHttpClientFactory.kt (Android).
 * Rotate when a host changes CA / certificate chain.
 *
 * Android pinning is enforced natively via OkHttp CertificatePinner (DoH factory).
 * iOS pinning is enabled here via TrustKit (react-native-ssl-public-key-pinning).
 * Do not initialize this library on Android — it can replace our OkHttp client and
 * break Cloudflare DoH.
 */
const API_PINNING_OPTIONS = {
  'www.qrshop.online': {
    includeSubdomains: false,
    publicKeyHashes: [
      '3+zn2KT/mOeNBAcChjtnx3e0d4rIsPBtO9Gcigc4Qf8=',
      'nWN7PSep5XDQdge5zK24CnCRXHr3KvzhKEGxsdqCX9E=',
    ],
  },
  'qrshop.online': {
    includeSubdomains: false,
    publicKeyHashes: [
      '3+zn2KT/mOeNBAcChjtnx3e0d4rIsPBtO9Gcigc4Qf8=',
      'nWN7PSep5XDQdge5zK24CnCRXHr3KvzhKEGxsdqCX9E=',
    ],
  },
  'qr-shop-app-backend.vercel.app': {
    includeSubdomains: false,
    publicKeyHashes: [
      'xRUwi70J41GFIbtkDY38VXIAoWtbsGGG+LWfenCZh7k=',
      'yDu9og255NN5GEf+Bwa9rTrqFQ0EydZ0r1FCh9TdAW4=',
    ],
  },
  'qrshopmyanmar.netlify.app': {
    includeSubdomains: false,
    publicKeyHashes: [
      'DFv0rPImhleLzIvctvEusBa5wnzQ/+aSqyW18y26L+s=',
      'Wec45nQiFwKvHtuHxSAMGkt19k+uPSw9JlEkxhvYPHk=',
    ],
  },
} as const;

/**
 * Enable iOS SSL public-key pinning as early as possible.
 * Safe no-op on web, Android, and Expo Go (native module missing).
 */
export async function initSslPinning(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  if (!isSslPinningAvailable()) {
    return;
  }

  try {
    await initializeSslPinning(API_PINNING_OPTIONS);
  } catch (err) {
    console.warn('SSL pinning init failed:', err);
  }
}
