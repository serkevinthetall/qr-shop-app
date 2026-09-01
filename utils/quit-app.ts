import Constants from 'expo-constants';
import { BackHandler, Platform } from 'react-native';

/**
 * End the session and leave the app when possible.
 * Expo Go / iOS cannot kill the process — navigation to login is the fallback.
 */
export async function quitApp(signOut: () => Promise<void>, goLogin: () => void) {
  try {
    await signOut();
  } catch {
    // Continue even if logout API fails.
  }

  goLogin();

  const inExpoGo = Constants.appOwnership === 'expo';

  if (Platform.OS === 'android' && !inExpoGo) {
    BackHandler.exitApp();
  }
}
