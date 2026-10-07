/**
 * Customer support contacts shown on Account → Need help.
 *
 * Facebook: open https://facebook.com/qrshopmyanmar so the Page loads
 * (Facebook app via App Links when installed, otherwise browser).
 *
 * Viber: iOS and Android need different deep-link shapes.
 */
import { Linking, Platform } from 'react-native';

const VIBER_NUMBER_DIGITS = '959775296296';

export const SUPPORT_CONFIG = {
  /** Display + dial number (Myanmar local form). */
  phoneDisplay: '09775296296',
  phoneTel: 'tel:+959775296296',
  /**
   * iOS: contact sheet (chat?number= often fails with Request Unavailable).
   * Android: chat with digits only (no +).
   */
  viberUrl:
    Platform.OS === 'ios'
      ? `viber://contact?number=%2B${VIBER_NUMBER_DIGITS}`
      : `viber://chat?number=${VIBER_NUMBER_DIGITS}`,
  /** Fallbacks if the primary Viber link is rejected by the OS. */
  viberFallbackUrls:
    Platform.OS === 'ios'
      ? [
          `viber://add?number=${VIBER_NUMBER_DIGITS}`,
          `viber://chat?number=${VIBER_NUMBER_DIGITS}`,
          `viber://chat?number=%2B${VIBER_NUMBER_DIGITS}`,
        ]
      : [
          `viber://add?number=${VIBER_NUMBER_DIGITS}`,
          `viber://contact?number=%2B${VIBER_NUMBER_DIGITS}`,
          `viber://chat?number=%2B${VIBER_NUMBER_DIGITS}`,
        ],
  facebookPageUrl: 'https://www.facebook.com/qrshopmyanmar',
} as const;

/** Open tel: / viber:// / https candidates until one is accepted by the OS. */
export async function openExternalUrl(url: string, fallbacks: readonly string[] = []): Promise<boolean> {
  const candidates = [url, ...fallbacks];
  for (const candidate of candidates) {
    try {
      await Linking.openURL(candidate);
      return true;
    } catch {
      // try next
    }
  }
  return false;
}

/** Open the QR Shop Myanmar Facebook Page. */
export async function openFacebookPage(): Promise<boolean> {
  return openExternalUrl(SUPPORT_CONFIG.facebookPageUrl, [
    'https://facebook.com/qrshopmyanmar',
    'https://m.facebook.com/qrshopmyanmar',
  ]);
}

export async function openViberChat(): Promise<boolean> {
  return openExternalUrl(SUPPORT_CONFIG.viberUrl, SUPPORT_CONFIG.viberFallbackUrls);
}
