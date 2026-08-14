/**
 * ============================================================================
 *  APP COLOR PALETTE — single source of truth
 * ============================================================================
 *
 *  Edit this file to change ANY color in the app for light and dark mode.
 *  Every screen/component reads its colors from here (via `useAppColors()`),
 *  and the React Native Paper + React Navigation themes are derived from it too.
 *
 *  HOW TO USE
 *  ----------
 *  - Change a value under `light` to affect light mode.
 *  - Change a value under `dark` to affect dark mode.
 *  - Keep the SAME keys in both `light` and `dark` (types enforce this).
 *  - In components, access colors with:  const colors = useAppColors();
 *      e.g. colors.primary, colors.text, colors.card ...
 *
 *  Brand: Charcoal + Teal (aligned with the QR SHOP MYANMAR logo).
 *  Dark mode: "Ink & Teal" — ink slate surfaces with teal CTAs (eye-strain friendly).
 * ============================================================================
 */

export type AppColorTokens = {
  // ---- Surfaces / backgrounds -------------------------------------------
  /** App screen background (the base layer behind everything). */
  background: string;
  /** Elevated surface (sheets, headers). */
  surface: string;
  /** Cards, list rows, modals. */
  card: string;
  /** Slightly contrasting screen background, used to make white cards pop
   *  (e.g. the Orders list). */
  screenAlt: string;
  /** Hairline borders / dividers. */
  border: string;
  /** Text input fill. */
  inputBg: string;

  // ---- Text / icons ------------------------------------------------------
  /** Primary text color. */
  text: string;
  /** Secondary / muted text (labels, hints, captions). */
  textMuted: string;
  /** Default icon color. */
  icon: string;

  // ---- Brand / primary accent (CTAs, active states, links) --------------
  /** Main accent — buttons, active tab, links, spinners. */
  primary: string;
  /** Text/icon color shown ON TOP of a `primary` fill. */
  onPrimary: string;
  /** Soft tint of primary (chips, subtle highlights). */
  primaryMuted: string;
  /** Container fill for primary (Paper primaryContainer). */
  primaryContainer: string;
  /** Text/icon ON TOP of `primaryContainer`. */
  onPrimaryContainer: string;

  // ---- Status colors -----------------------------------------------------
  /** Success (confirmations, coupons). */
  success: string;
  /** Success background tint. */
  successBg: string;
  /** Danger / error / destructive. */
  danger: string;
  /** Danger background tint. */
  dangerBg: string;

  // ---- Tab bar / navigation ---------------------------------------------
  /** Tab bar background. */
  tabBar: string;
  /** Tab bar top border. */
  tabBarBorder: string;
  /** Inactive tab icon/label. */
  tabIconDefault: string;
  /** Active tab icon/label. */
  tabIconSelected: string;
  /** Navigation tint (used by legacy themed components). */
  tint: string;

  // ---- Effects / misc ----------------------------------------------------
  /** Shadow color for elevated cards. */
  shadow: string;
  /** Surface that must stay light so a QR code is scannable (both modes). */
  qrSurface: string;
};

export const AppColors: { light: AppColorTokens; dark: AppColorTokens } = {
  light: {
    // Surfaces
    background: '#f7f8f7',
    surface: '#ffffff',
    card: '#ffffff',
    screenAlt: '#e2e6e3',
    border: '#e8ebe9',
    inputBg: '#f1f3f2',

    // Text / icons
    text: '#1c1f23',
    textMuted: '#6b7280',
    icon: '#6b7280',

    // Brand / primary
    primary: '#0d9488',
    onPrimary: '#ffffff',
    primaryMuted: '#ccfbf1',
    primaryContainer: '#ccfbf1',
    onPrimaryContainer: '#0f3d39',

    // Status
    success: '#16a34a',
    successBg: '#dcfce7',
    danger: '#dc2626',
    dangerBg: '#fee2e2',

    // Tabs / navigation
    tabBar: '#ffffff',
    tabBarBorder: '#e8ebe9',
    tabIconDefault: '#9aa4b2',
    tabIconSelected: '#0d9488',
    tint: '#0d9488',

    // Effects / misc
    shadow: '#0f172a',
    qrSurface: '#f7f8f7',
  },
  dark: {
    // Ink & Teal — Product Details palette (no pure black)
    // Surfaces
    background: '#121818',
    surface: '#1D2525',
    card: '#1D2525',
    screenAlt: '#121818',
    border: '#2A3333',
    inputBg: '#171F1F',

    // Text / icons
    text: '#F1F5F4',
    textMuted: '#9BA8A7',
    icon: '#9BA8A7',

    // Brand / primary — CTA #2A9D98, accent/price pop #43BDB6
    primary: '#2A9D98',
    onPrimary: '#F1F5F4',
    primaryMuted: '#1A3332',
    primaryContainer: '#1A3332',
    onPrimaryContainer: '#43BDB6',

    // Status
    success: '#34D399',
    successBg: '#14532D',
    danger: '#F87171',
    dangerBg: '#7F1D1D',

    // Tabs / navigation
    tabBar: '#1D2525',
    tabBarBorder: '#2A3333',
    tabIconDefault: '#9BA8A7',
    tabIconSelected: '#43BDB6',
    tint: '#43BDB6',

    // Effects / misc
    shadow: '#000000',
    qrSurface: '#F1F5F4',
  },
};

/** Returns the full token set for the active mode. */
export function getAppColors(isDark: boolean): AppColorTokens {
  return isDark ? AppColors.dark : AppColors.light;
}
