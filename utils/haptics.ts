import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function hapticLight() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function hapticMedium() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticSuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Stronger tab tap — Light is easy to miss on many Android phones. */
export function hapticTabPress() {
  if (Platform.OS === 'android') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  });
}

/** Wrap a press handler so every tap fires a light haptic first. */
export function withHapticPress<Args extends unknown[]>(
  onPress?: (...args: Args) => void,
  style: 'light' | 'medium' | 'success' = 'light',
): (...args: Args) => void {
  return (...args: Args) => {
    if (style === 'success') {
      hapticSuccess();
    } else if (style === 'medium') {
      hapticMedium();
    } else {
      hapticLight();
    }
    onPress?.(...args);
  };
}
