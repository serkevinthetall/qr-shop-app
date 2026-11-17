import { Platform } from 'react-native';
import {
  initializeSslPinning,
  isSslPinningAvailable,
} from 'react-native-ssl-public-key-pinning';

/**
 * Pin map empty during Platform API cutover — TrustKit only enforces listed
 * hosts. api.qrshopmyanmar.com / localhost use normal TLS until SPKI hashes
 * are measured and added here.
 */
const API_PINNING_OPTIONS: Record<
  string,
  { includeSubdomains: boolean; publicKeyHashes: string[] }
> = {};

/**
 * Enable iOS SSL public-key pinning as early as possible.
 * Safe no-op on web, Android, Expo Go, or when no hosts are pinned.
 */
export async function initSslPinning(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  if (!isSslPinningAvailable()) {
    return;
  }

  if (Object.keys(API_PINNING_OPTIONS).length === 0) {
    return;
  }

  try {
    await initializeSslPinning(API_PINNING_OPTIONS);
  } catch (err) {
    console.warn('SSL pinning init failed:', err);
  }
}
