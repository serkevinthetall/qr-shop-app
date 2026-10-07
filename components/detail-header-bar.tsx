import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidSurface } from '@/components/liquid-surface';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { isLiquidUiEnabled, liquidDetailHeaderTint } from '@/utils/liquid-ui';

type DetailHeaderBarProps = {
  title: string;
  /** Override horizontal padding (notifications uses default 16). */
  paddingHorizontal?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Back + title bar for stack screens (Addresses, Reset Password, Notifications, Checkout, Order Detail, …).
 * Liquid iOS: frost extends under the status bar (translucent white / dark — no mint).
 * Android / older iOS: solid `colors.surface` (unchanged). Parents should drop the
 * top safe-area edge when liquid so this bar owns the inset.
 */
export function DetailHeaderBar({ title, paddingHorizontal, style }: DetailHeaderBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { fs, lh } = useLanguage();
  const { rs, horizontalPadding } = useResponsive();
  const liquid = isLiquidUiEnabled();
  const pad = paddingHorizontal ?? horizontalPadding;
  const titleColor = liquid && !isDark ? '#111827' : colors.text;
  const iconColor = liquid && !isDark ? '#111827' : colors.text;

  return (
    <LiquidSurface
      style={[
        styles.headerBar,
        {
          borderBottomColor: liquid ? 'transparent' : colors.border,
          borderBottomWidth: liquid ? 0 : StyleSheet.hairlineWidth,
          paddingHorizontal: pad,
          paddingTop: (liquid ? insets.top : 0) + 10,
        },
        style,
      ]}
      backgroundColor={colors.surface}
      tintColor={liquid ? liquidDetailHeaderTint(isDark) : undefined}
      glassStyle="regular">
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}>
        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
      </Pressable>
      <Text
        style={[styles.headerTitle, { color: titleColor, fontSize: fs(rs(20)), lineHeight: lh(20) }]}
        numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSpacer} />
    </LiquidSurface>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
});
