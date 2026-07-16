export const WELCOME_SEEN_KEY = 'qr-app-welcome-seen';

export async function hasSeenWelcome() {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  const value = await AsyncStorage.getItem(WELCOME_SEEN_KEY);
  return value === 'true';
}

export async function markWelcomeSeen() {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  await AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true');
}
