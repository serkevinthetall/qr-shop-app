import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MYANMAR_FONTS } from '@/constants/fonts';
import { useLanguage } from '@/contexts/language-context';
import { liquidTabBarClearance } from '@/utils/liquid-ui';

type AppToastProps = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  bottomOffset?: number;
};

type AppToastInnerProps = AppToastProps & {
  bottom: number;
};

function AppToastInner({
  message,
  visible,
  onDismiss,
  duration = 2200,
  bottom,
}: AppToastInnerProps) {
  const { language } = useLanguage();
  const isMyanmar = language === 'my';
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const [mounted, setMounted] = useState(false);
  const [shownMessage, setShownMessage] = useState(message);

  useEffect(() => {
    if (!visible || !message) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 8,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
      return;
    }

    setShownMessage(message);
    setMounted(true);
    opacity.setValue(0);
    translateY.setValue(12);
    scale.setValue(0.96);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message, duration, opacity, translateY, scale]);

  if (!mounted || !shownMessage) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity,
          bottom,
          transform: [{ translateY }, { scale }],
        },
      ]}>
      <View style={[styles.toast, isMyanmar && styles.toastMyanmar]}>
        <Text
          style={[
            styles.text,
            isMyanmar && styles.textMyanmar,
            isMyanmar ? { fontFamily: MYANMAR_FONTS.regular } : null,
          ]}>
          {shownMessage}
        </Text>
      </View>
    </Animated.View>
  );
}

export function AppToast({ bottomOffset = 8, ...props }: AppToastProps) {
  const insets = useSafeAreaInsets();
  return (
    <AppToastInner {...props} bottom={Math.max(insets.bottom, 8) + bottomOffset} />
  );
}

export function TabAppToast({ bottomOffset = 12, ...props }: AppToastProps) {
  const insets = useSafeAreaInsets();
  const clearance = liquidTabBarClearance(insets.bottom);
  const bottom =
    (clearance > 0 ? clearance : Math.max(insets.bottom, 8)) + bottomOffset;

  return <AppToastInner {...props} bottom={bottom} />;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 999,
    elevation: 24,
    overflow: 'visible',
  },
  toast: {
    backgroundColor: '#323232',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  toastMyanmar: {
    paddingTop: 20,
    paddingBottom: 22,
    minHeight: 58,
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 14,
  },
  textMyanmar: {
    fontSize: 15,
    ...(Platform.OS === 'android'
      ? {
          includeFontPadding: true,
          textAlignVertical: 'center' as const,
        }
      : {
          paddingTop: 4,
          paddingBottom: 4,
        }),
  },
});
