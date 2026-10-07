import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppColors } from '@/contexts/theme-context';

/**
 * Expo Go / edge-to-edge: Android system nav is transparent, so the app
 * background can swallow the gesture bar / 3-button nav. Paint a solid strip
 * in the bottom inset so those controls stay readable without a native rebuild.
 * Color matches the tab bar so the chrome reads as one continuous bar.
 */
export function AndroidSystemNavScrim() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();

  if (Platform.OS !== 'android') {
    return null;
  }

  const height = Math.max(insets.bottom, 0);
  if (height <= 0) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.scrim,
        {
          height,
          backgroundColor: colors.tabBar,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
  },
});
