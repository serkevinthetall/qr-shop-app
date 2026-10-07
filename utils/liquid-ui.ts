import {
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { Platform } from 'react-native';

/** Floating glass pill height (matches tab layout). */
export const LIQUID_TAB_PILL_HEIGHT = 68;

/**
 * Liquid UI — iOS 26+ only when native glass APIs exist.
 * Android and older iPhones stay solid / flat.
 */
export function isLiquidUiEnabled(): boolean {
  if (Platform.OS !== 'ios') {
    return false;
  }

  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

/**
 * Floating pill tab bar — iOS 26+ only.
 * Android always uses the normal flat full-width bar.
 */
export function isLiquidTabBarEnabled(): boolean {
  return Platform.OS === 'ios' && isLiquidUiEnabled();
}

/** Extra bottom space so footers/toasts clear the floating pill + dock gap. */
export function liquidTabBarClearance(bottomInset: number): number {
  if (!isLiquidUiEnabled()) {
    return 0;
  }

  return LIQUID_TAB_PILL_HEIGHT + Math.max(bottomInset, 12);
}

/** Match app theme for GlassView colorScheme. */
export function liquidGlassColorScheme(isDark: boolean): 'light' | 'dark' {
  return isDark ? 'dark' : 'light';
}

/**
 * Glass tint for LiquidSurface (headers, cards, sheets).
 * Keep translucent so real Liquid Glass still reads through.
 */
export function liquidGlassTint(isDark: boolean): string {
  return isDark ? 'rgba(67, 189, 182, 0.16)' : 'rgba(13, 148, 136, 0.12)';
}

/**
 * Detail stack headers (Addresses, Reset Password, Notifications, …).
 * Light: translucent white (no mint). Dark: translucent charcoal.
 */
export function liquidDetailHeaderTint(isDark: boolean): string {
  return isDark ? 'rgba(28, 28, 30, 0.55)' : 'rgba(255, 255, 255, 0.52)';
}

/** Soft fill for nested controls on glass (search, qty buttons, chips). */
export function liquidGlassFill(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.35)';
}

/** Hairline edge on glass cards / shells. */
export function liquidGlassBorder(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.45)';
}

// --- Floating tab bar (iOS 26+ only; Android / older iOS stay flat) ---

export const LIQUID_BLUR_INTENSITY = 72;

/** Blur + frost fill for the floating pill. */
export function liquidTabBarBlurTint(isDark: boolean): 'light' | 'dark' {
  return isDark ? 'dark' : 'light';
}

export function liquidTabBarUnderlay(isDark: boolean): string {
  // Light: translucent white. Dark: translucent black.
  return isDark ? 'rgba(0, 0, 0, 0.58)' : 'rgba(255, 255, 255, 0.72)';
}

export function liquidTabBarWash(isDark: boolean): string {
  return isDark ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.18)';
}

export function liquidTabBarSuspendedFill(isDark: boolean): string {
  return isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(255, 255, 255, 0.88)';
}

/** Focused icon — teal in both modes. */
export const LIQUID_TAB_BAR_ICON_ACTIVE = '#0d9488';
export const LIQUID_TAB_BAR_ICON_ACTIVE_DARK = '#43BDB6';

export function liquidTabBarIconActive(isDark: boolean): string {
  return isDark ? LIQUID_TAB_BAR_ICON_ACTIVE_DARK : LIQUID_TAB_BAR_ICON_ACTIVE;
}

export function liquidTabBarIconInactive(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(0, 0, 0, 0.55)';
}

export function liquidTabBarLabelActive(isDark: boolean): string {
  return isDark ? '#FFFFFF' : '#111827';
}

export function liquidTabBarLabelInactive(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.88)' : 'rgba(0, 0, 0, 0.72)';
}

/** Icon halo on the floating pill — only when focused. */
export function liquidTabBarIconHaloFill(isDark: boolean, focused: boolean): string | undefined {
  if (!focused) {
    return undefined;
  }
  return isDark ? 'rgba(67, 189, 182, 0.28)' : 'rgba(13, 148, 136, 0.18)';
}
