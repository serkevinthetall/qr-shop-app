import { getExpoPushTokenWithRetry } from '@/services/device-notifications';
import { registerPushToken } from '@/services/notification-api';
import type { Language } from '@/constants/translations';

/**
 * Completes push permission + Expo token + server register.
 * Used during login loading so background push works before home screen.
 * Never throws — login must succeed even if push setup fails.
 */
export async function registerPushForAuthSession(
  authToken: string,
  language: Language,
): Promise<boolean> {
  try {
    const expoPushToken = await getExpoPushTokenWithRetry();

    if (!expoPushToken) {
      return false;
    }

    await registerPushToken(authToken, expoPushToken, language);
    return true;
  } catch (err) {
    console.warn('Login push registration failed:', err);
    return false;
  }
}
