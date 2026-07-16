import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const BASE_WIDTH = 375;

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const scale = Math.min(Math.max(width / BASE_WIDTH, 0.85), 1.25);
    const isSmall = width < 360;
    const isLarge = width >= 414;
    const isTablet = width >= 768;
    const horizontalPadding = isTablet ? 32 : isSmall ? 12 : 16;
    const contentMaxWidth = Math.min(width - horizontalPadding * 2, isTablet ? 560 : 480);
    const gridColumns = isTablet ? 3 : 2;
    const gridGap = isSmall ? 8 : 12;

    const rs = (size: number) => Math.round(size * scale);

    return {
      width,
      height,
      scale,
      isSmall,
      isLarge,
      isTablet,
      horizontalPadding,
      contentMaxWidth,
      gridColumns,
      gridGap,
      rs,
    };
  }, [width, height]);
}
