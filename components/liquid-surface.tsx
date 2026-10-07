import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useThemeMode } from '@/contexts/theme-context';
import {
  isLiquidUiEnabled,
  liquidGlassColorScheme,
  liquidGlassTint,
} from '@/utils/liquid-ui';

type LiquidSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Solid fill when liquid UI is off. */
  backgroundColor?: string;
  /** Optional glass tint. Defaults to a light brand tint. */
  tintColor?: string;
  glassStyle?: 'clear' | 'regular';
  interactive?: boolean;
  /**
   * Stable id for list rows (e.g. product id). Remounts GlassView when the
   * recycled cell binds a new item so the effect does not vanish.
   */
  remountKey?: string | number;
  /** Kept for call-site compatibility (glass is always a backdrop layer). */
  contentMode?: 'wrap' | 'backdrop';
  /**
   * Corner radius on GlassView. If omitted, uses `borderRadius` from `style`.
   */
  cornerRadius?: number;
};

function resolveCornerRadius(
  style: StyleProp<ViewStyle> | undefined,
  cornerRadius: number | undefined,
): number | undefined {
  if (cornerRadius != null) {
    return cornerRadius;
  }

  const flat = StyleSheet.flatten(style);
  const radius = flat?.borderRadius;
  return typeof radius === 'number' ? radius : undefined;
}

/**
 * Real Liquid Glass (UIGlassEffect) for iOS 26+ chrome — headers, cards, sheets.
 * The floating tab bar is separate (locked BlurView).
 * Android / older iOS render a normal View.
 */
export function LiquidSurface({
  children,
  style,
  backgroundColor,
  tintColor,
  glassStyle = 'regular',
  interactive = false,
  remountKey,
  cornerRadius,
}: LiquidSurfaceProps) {
  const { isDark } = useThemeMode();

  if (!isLiquidUiEnabled()) {
    return <View style={[style, backgroundColor ? { backgroundColor } : null]}>{children}</View>;
  }

  const glassKey = remountKey != null ? `glass-${remountKey}` : undefined;
  const radius = resolveCornerRadius(style, cornerRadius);
  // Clip glass to rounded corners — without overflow:hidden, UIGlassEffect paints square.
  const clipStyle =
    radius != null
      ? { borderRadius: radius, overflow: 'hidden' as const, borderCurve: 'continuous' as const }
      : null;

  return (
    <View style={[style, clipStyle]}>
      <GlassView
        key={glassKey}
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, clipStyle]}
        glassEffectStyle={glassStyle}
        tintColor={tintColor ?? liquidGlassTint(isDark)}
        colorScheme={liquidGlassColorScheme(isDark)}
        isInteractive={interactive}
      />
      {children}
    </View>
  );
}
