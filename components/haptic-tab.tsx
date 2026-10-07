'use no memo';

import type { BottomTabBarButtonProps } from 'expo-router/tabs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { useRevealLiquidTabBar } from '@/contexts/liquid-tab-bar-visibility';
import { hapticTabPress } from '@/utils/haptics';

const POP_COLOR = '#0d9488';
const POP_COUNT = 5;

type Spark = {
  angle: number;
  distance: number;
  size: number;
  spin: number;
};

/**
 * Tab pressable: stronger haptic + icon pop + tiny birthday confetti burst.
 *
 * Uses RN Pressable (not PlatformPressable) so Android does not force a
 * rectangular ripple over the whole tab.
 *
 * Opted out of React Compiler — tab buttons triggered useMemoCache size
 * mismatches after Fast Refresh (13 vs 7).
 */
export function HapticTab(props: BottomTabBarButtonProps) {
  const { children, style, onPress, onPressIn, onPressOut, ...rest } = props;
  const revealTabBar = useRevealLiquidTabBar();
  const scale = useRef(new Animated.Value(1)).current;
  const popAnim = useRef<Animated.CompositeAnimation | null>(null);
  const [burstKey, setBurstKey] = useState(0);

  const pressInPop = () => {
    popAnim.current?.stop();
    popAnim.current = Animated.timing(scale, {
      toValue: 0.88,
      duration: 70,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    popAnim.current.start();
  };

  const pressOutPop = () => {
    popAnim.current?.stop();
    popAnim.current = Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.12,
        friction: 4,
        tension: 340,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 220,
        useNativeDriver: true,
      }),
    ]);
    popAnim.current.start();
  };

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      android_ripple={null}
      style={style}
      onPressIn={(ev) => {
        hapticTabPress();
        revealTabBar();
        pressInPop();
        setBurstKey((k) => k + 1);
        onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        pressOutPop();
        onPressOut?.(ev);
      }}>
      <View style={styles.content} pointerEvents="box-none">
        {burstKey > 0 ? <TabConfettiBurst key={burstKey} /> : null}
        <Animated.View style={[styles.popLayer, { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      </View>
    </Pressable>
  );
}

/** Mini party burst from the icon — short, local, birthday-style pop-off. */
function TabConfettiBurst() {
  const sparks = useMemo<Spark[]>(
    () =>
      Array.from({ length: POP_COUNT }, (_, i) => ({
        angle: (Math.PI * 2 * i) / POP_COUNT + (Math.random() - 0.5) * 0.35,
        distance: 18 + Math.random() * 22,
        size: 4 + Math.random() * 4,
        spin: (Math.random() - 0.5) * 260,
      })),
    [],
  );

  return (
    <View pointerEvents="none" style={styles.burstAnchor}>
      {sparks.map((spark, index) => (
        <SparkPiece key={index} spark={spark} />
      ))}
    </View>
  );
}

function SparkPiece({ spark }: { spark: Spark }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.cos(spark.angle) * spark.distance],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.sin(spark.angle) * spark.distance - 8],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${spark.spin}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0.4, 1.15, 0.6],
  });

  return (
    <Animated.View
      style={[
        styles.spark,
        {
          width: spark.size,
          height: spark.size * 1.35,
          borderRadius: spark.size / 3,
          backgroundColor: POP_COLOR,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate }, { scale }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  popLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  burstAnchor: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  spark: {
    position: 'absolute',
  },
});
