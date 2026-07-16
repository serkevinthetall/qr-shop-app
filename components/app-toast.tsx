import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MYANMAR_FONTS } from '@/constants/fonts';
import { useLanguage } from '@/contexts/language-context';

type AppToastProps = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  /**
   * Extra gap above the calculated bottom anchor (tab bar or safe area).
   * Default 8.
   */
  bottomOffset?: number;
};

type AppToastInnerProps = AppToastProps & {
  /** Absolute bottom distance from the bottom of the window/parent. */
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
  const [mounted, setMounted] = useState(false);
  const [shownMessage, setShownMessage] = useState(message);

  useEffect(() => {
    if (!visible || !message) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
      return;
    }

    setShownMessage(message);
    setMounted(true);
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message, duration, opacity]);

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

/** Toast for screens outside the tab bar (product detail, etc.). */
export function AppToast({ bottomOffset = 8, ...props }: AppToastProps) {
  const insets = useSafeAreaInsets();
  return (
    <AppToastInner {...props} bottom={Math.max(insets.bottom, 8) + bottomOffset} />
  );
}

/**
 * Toast for tab screens.
 * Tab content is already laid out above the tab bar, so only a small gap is needed.
 * Adding `useBottomTabBarHeight()` here double-counts and makes the toast "fly".
 */
export function TabAppToast({ bottomOffset = 10, ...props }: AppToastProps) {
  return <AppToastInner {...props} bottom={bottomOffset} />;
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
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'visible',
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
    // Natural metrics + padding (fixed lineHeight still clips Burmese marks).
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
