import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

const PROMPT_KEY = 'qrshop.storeReview.lastPromptAt';
const RATED_KEY = 'qrshop.storeReview.completed';
/** Don't auto-ask again for 45 days. */
const PROMPT_COOLDOWN_MS = 45 * 24 * 60 * 60 * 1000;

export const STORE_URLS = {
  android: 'https://play.google.com/store/apps/details?id=com.qrshop.myanmar&showAllReviews=true',
  ios: 'https://apps.apple.com/app/id6800218923?action=write-review',
} as const;

export function getStoreReviewUrl() {
  return Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
}

export async function hasCompletedStoreRating(): Promise<boolean> {
  const value = await AsyncStorage.getItem(RATED_KEY);
  return value === '1';
}

export async function markStoreRatingCompleted(): Promise<void> {
  await AsyncStorage.setItem(RATED_KEY, '1');
  await AsyncStorage.setItem(PROMPT_KEY, String(Date.now()));
}

export async function shouldAutoPromptStoreRating(): Promise<boolean> {
  if (await hasCompletedStoreRating()) {
    return false;
  }

  const last = await AsyncStorage.getItem(PROMPT_KEY);
  if (!last) {
    return true;
  }

  const elapsed = Date.now() - Number(last);
  return !Number.isFinite(elapsed) || elapsed >= PROMPT_COOLDOWN_MS;
}

/** Open Play Store / App Store write-review page. */
export async function openStoreReviewPage(): Promise<boolean> {
  try {
    await Linking.openURL(getStoreReviewUrl());
    await markStoreRatingCompleted();
    return true;
  } catch {
    return false;
  }
}
