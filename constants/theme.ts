/**
 * Navigation / legacy themed-component color tokens.
 *
 * These are derived from the single source of truth in `app-colors.ts`.
 * To change colors, edit `constants/app-colors.ts` (not this file).
 */

import { Platform } from 'react-native';

import { AppColors } from './app-colors';

function navColors(mode: 'light' | 'dark') {
  const c = AppColors[mode];
  return {
    text: c.text,
    background: c.background,
    surface: c.surface,
    tint: c.tint,
    icon: c.icon,
    tabIconDefault: c.tabIconDefault,
    tabIconSelected: c.tabIconSelected,
    border: c.border,
  };
}

export const Colors = {
  light: navColors('light'),
  dark: navColors('dark'),
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
