import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

const VAN_IMAGE = require('@/assets/images/delivery-van.png');
const LOGO_LIGHT = require('@/assets/images/icon.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { width, rs } = useResponsive();
  const vanWidth = rs(220);
  const vanHeight = (vanWidth * 682) / 1024;
  const vanX = useSharedValue(-vanWidth);
  const logoSize = rs(132);

  useEffect(() => {
    const travelDistance = width + vanWidth;

    vanX.value = -vanWidth;
    vanX.value = withRepeat(
      withTiming(travelDistance, { duration: 2600, easing: Easing.linear }),
      -1,
      false,
    );
  }, [vanX, vanWidth, width]);

  const vanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: vanX.value }],
  }));

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Image
          source={isDark ? LOGO_DARK : LOGO_LIGHT}
          style={{ width: logoSize, height: logoSize, marginBottom: rs(12) }}
          resizeMode="contain"
          accessibilityLabel="QR Shop Myanmar"
        />

        <View style={[styles.track, { height: vanHeight + rs(8), width }]}>
          <Animated.View style={[styles.vanWrap, vanStyle]}>
            <Image
              source={VAN_IMAGE}
              style={{ width: vanWidth, height: vanHeight }}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <Text style={[styles.loadingText, { color: colors.text, fontSize: rs(16) }]}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  vanWrap: {
    position: 'absolute',
    left: 0,
  },
  loadingText: {
    marginTop: 28,
    fontWeight: '600',
  },
});
