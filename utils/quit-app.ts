import Constants from 'expo-constants';
import { BackHandler, Platform } from 'react-native';

/**
 * Close the app process when the OS allows it.
 * Does not sign the user out — session stays for the next launch.
 * Expo Go / iOS cannot kill the process (Apple forbids it).
 */
export function exitAppProcess() {
  const inExpoGo = Constants.appOwnership === 'expo';

  if (Platform.OS === 'android' && !inExpoGo) {
    BackHandler.exitApp();
  }
}
