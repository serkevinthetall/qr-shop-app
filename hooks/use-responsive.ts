import { useEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

const BASE_WIDTH = 375;
/** Browser width at/above this → website chrome. Below → phone UI (same as app). */
export const WEBSITE_BREAKPOINT = 768;

function readBrowserWidth(fallback: number) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.innerWidth || fallback;
  }
  return fallback;
}

/** True only for wide browser — never on iOS/Android. Safe outside React. */
export function isWebsiteLayoutNow(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }
  return window.innerWidth >= WEBSITE_BREAKPOINT;
}

/**
 * - **Phone / app** (native always, OR browser &lt; 768): unchanged app layout + bottom tabs
 * - **Website** (browser ≥ 768 only): hamburger + wider mall content — does not affect the app
 */
export function useResponsive() {
  const { width: rnWidth, height: rnHeight } = useWindowDimensions();
  const [webWidth, setWebWidth] = useState(() => readBrowserWidth(rnWidth));

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const sync = () => setWebWidth(window.innerWidth);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  const width = Platform.OS === 'web' ? webWidth || rnWidth : rnWidth;
  const height = rnHeight;

  return useMemo(() => {
    const scale = Math.min(Math.max(width / BASE_WIDTH, 0.85), 1.25);
    const isSmall = width < 360;
    const isLarge = width >= 414;
    const isTablet = width >= WEBSITE_BREAKPOINT;
    const isDesktop = width >= 1024;
    const isWide = width >= 1280;
    const isWeb = Platform.OS === 'web';
    const isNative = Platform.OS === 'android' || Platform.OS === 'ios';

    /** Native app always phone chrome; narrow browser also phone chrome. */
    const isPhoneLayout = isNative || !isWeb || width < WEBSITE_BREAKPOINT;
    /** Wide browser only — never changes iOS/Android. */
    const isWebsiteLayout = isWeb && width >= WEBSITE_BREAKPOINT;
    const showBottomNav = isPhoneLayout;
    const showHamburger = isWebsiteLayout;

    // Phone / app path: keep prior padding + max-width exactly.
    const phoneHorizontalPadding = isTablet ? 32 : isSmall ? 12 : 16;
    const phoneContentMaxWidth = Math.min(
      width - phoneHorizontalPadding * 2,
      isTablet ? 560 : 480,
    );
    const phoneGridColumns = isTablet ? 3 : 2;
    const phoneGridGap = isSmall ? 8 : 12;

    const horizontalPadding = isWebsiteLayout
      ? isWide
        ? 48
        : isDesktop
          ? 40
          : 28
      : phoneHorizontalPadding;

    const contentMaxWidth = isWebsiteLayout
      ? Math.min(width, isWide ? 1200 : isDesktop ? 1040 : 880)
      : phoneContentMaxWidth;

    const gridColumns = isWebsiteLayout
      ? isWide
        ? 4
        : isDesktop
          ? 3
          : 3
      : phoneGridColumns;

    const gridGap = isWebsiteLayout ? (isDesktop ? 20 : 16) : phoneGridGap;

    const rs = (size: number) => Math.round(size * scale);

    return {
      width,
      height,
      scale,
      isSmall,
      isLarge,
      isTablet,
      isDesktop,
      isWide,
      isWeb,
      isNative,
      isPhoneLayout,
      isWebsiteLayout,
      showBottomNav,
      showHamburger,
      horizontalPadding,
      contentMaxWidth,
      gridColumns,
      gridGap,
      rs,
    };
  }, [width, height]);
}
