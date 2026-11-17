import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppColors } from '@/contexts/theme-context';
import { hapticLight } from '@/utils/haptics';
import { isLiquidTabBarEnabled, liquidTabBarClearance } from '@/utils/liquid-ui';

const SIZE = 44;
const FLOAT_DISTANCE = 5;

type ScrollToTopButtonProps = {
  visible: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

/**
 * Solid circular ↑↑ control matched to the bottom nav.
 * Soft float bob on liquid iOS only; Android stays still just above the tab bar.
 */
export function ScrollToTopButton({
  visible,
  onPress,
  accessibilityLabel,
}: ScrollToTopButtonProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const floating = isLiquidTabBarEnabled();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const floatLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 140,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: visible ? 1 : 0.88,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, visible]);

  useEffect(() => {
    floatLoopRef.current?.stop();
    floatLoopRef.current = null;
    floatY.setValue(0);

    if (!visible || !floating) {
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -FLOAT_DISTANCE,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: FLOAT_DISTANCE,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    floatLoopRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
    };
  }, [floatY, floating, visible]);

  // Liquid iOS clears the floating pill; Android content already ends above the bar.
  const bottom = floating ? liquidTabBarClearance(insets.bottom) + 10 : 12;

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        {
          bottom,
          opacity,
          transform: [{ translateY: floatY }, { scale }],
        },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          hapticLight();
          onPress();
        }}
        style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
        <View
          style={[
            styles.circle,
            {
              backgroundColor: colors.tabBar,
              borderColor: colors.tabBarBorder,
            },
          ]}>
          <MaterialIcons
            name="keyboard-double-arrow-up"
            size={26}
            color={colors.primary}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    zIndex: 30,
  },
  hit: {
    borderRadius: SIZE / 2,
  },
  pressed: {
    opacity: 0.85,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
});
