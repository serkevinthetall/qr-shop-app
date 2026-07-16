import { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { useAppColors } from '@/contexts/theme-context';

type SkeletonBoxProps = {
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
};

export function SkeletonBox({ style, borderRadius = 8 }: SkeletonBoxProps) {
  const colors = useAppColors();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.inputBg,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}
