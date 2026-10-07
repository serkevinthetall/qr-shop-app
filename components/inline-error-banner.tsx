import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { hapticLight } from '@/utils/haptics';

type InlineErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retrying?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Clear, hard-to-miss error strip with optional Retry — used on Products / Orders / Account.
 */
export function InlineErrorBanner({
  message,
  onRetry,
  onDismiss,
  retrying = false,
  style,
}: InlineErrorBannerProps) {
  const colors = useAppColors();
  const { t, fs, lh } = useLanguage();
  const { rs } = useResponsive();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-6)).current;
  const retryScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!message) {
      return;
    }
    opacity.setValue(0);
    translateY.setValue(-8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [message, opacity, translateY]);

  if (!message) {
    return null;
  }

  const pulseRetry = () => {
    Animated.sequence([
      Animated.timing(retryScale, {
        toValue: 0.94,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(retryScale, {
        toValue: 1,
        friction: 5,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: colors.dangerBg,
          borderColor: colors.danger,
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <MaterialCommunityIcons
        name="alert-circle-outline"
        size={22}
        color={colors.danger}
        style={styles.icon}
      />
      <View style={styles.body}>
        <Text
          style={[
            styles.message,
            { color: colors.text, fontSize: fs(rs(13)), lineHeight: lh(13) },
          ]}>
          {message}
        </Text>
        {onRetry ? (
          <Animated.View style={{ transform: [{ scale: retryScale }], alignSelf: 'flex-start' }}>
            <Pressable
              onPress={() => {
                if (retrying) return;
                hapticLight();
                pulseRetry();
                onRetry();
              }}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityLabel={t('network.retry')}
              style={({ pressed }) => [
                styles.retryBtn,
                {
                  backgroundColor: colors.danger,
                  opacity: retrying ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}>
              <Text
                style={[
                  styles.retryLabel,
                  { color: colors.onPrimary, fontSize: fs(rs(13)), lineHeight: lh(13) },
                ]}>
                {retrying ? '...' : t('network.retry')}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          onPress={() => {
            hapticLight();
            onDismiss();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('errors.dismiss')}
          style={styles.dismiss}>
          <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    marginTop: 1,
  },
  body: {
    flex: 1,
    gap: 10,
  },
  message: {
    fontWeight: '500',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryLabel: {
    fontWeight: '700',
  },
  dismiss: {
    padding: 2,
  },
});
