import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

const COLORS = ['#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#22c55e', '#ec4899'];
const PARTICLE_COUNT = 42;

type CelebrationBurstProps = {
  active: boolean;
  onFinished?: () => void;
};

type Particle = {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  drift: number;
  rotate: number;
};

export function CelebrationBurst({ active, onFinished }: CelebrationBurstProps) {
  const particles = useMemo<Particle[]>(() => {
    const width = Dimensions.get('window').width;
    return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      left: Math.random() * width,
      delay: Math.random() * 280,
      duration: 1600 + Math.random() * 1200,
      size: 6 + Math.random() * 8,
      color: COLORS[index % COLORS.length],
      drift: -40 + Math.random() * 80,
      rotate: Math.random() * 360,
    }));
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const timer = setTimeout(() => {
      onFinished?.();
    }, 2800);

    return () => clearTimeout(timer);
  }, [active, onFinished]);

  if (!active) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {particles.map((particle, index) => (
        <FallingPiece key={`${active}-${index}`} particle={particle} />
      ))}
    </View>
  );
}

function FallingPiece({ particle }: { particle: Particle }) {
  const progress = useRef(new Animated.Value(0)).current;
  const height = Dimensions.get('window').height;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: particle.duration,
      delay: particle.delay,
      useNativeDriver: true,
    }).start();
  }, [particle.delay, particle.duration, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, height + 40],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, particle.drift],
  });
  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${particle.rotate}deg`, `${particle.rotate + 220}deg`],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: particle.left,
          width: particle.size,
          height: particle.size * 1.4,
          borderRadius: particle.size / 3,
          backgroundColor: particle.color,
          opacity,
          transform: [{ translateY }, { translateX }, { rotate }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  piece: {
    position: 'absolute',
    top: 0,
  },
});
