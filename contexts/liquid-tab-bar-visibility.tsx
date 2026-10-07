import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isLiquidUiEnabled, LIQUID_TAB_PILL_HEIGHT } from '@/utils/liquid-ui';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

type ScrollProps = {
  onScrollBeginDrag: (e: ScrollEvent) => void;
  onMomentumScrollBegin: (e: ScrollEvent) => void;
  onScrollEndDrag: () => void;
  onMomentumScrollEnd: () => void;
};

type LiquidTabBarVisibilityContextValue = {
  translateY: Animated.Value;
  /** True while the bar is sliding away — use solid fill, not GlassView. */
  glassSuspended: boolean;
  scrollProps: ScrollProps;
  reveal: () => void;
};

const LiquidTabBarVisibilityContext = createContext<LiquidTabBarVisibilityContextValue | null>(
  null,
);

const SHOW_DELAY_MS = 140;

export function LiquidTabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const enabled = isLiquidUiEnabled();
  const translateY = useRef(new Animated.Value(0)).current;
  const hiddenRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [glassSuspended, setGlassSuspended] = useState(false);
  const hideOffset = LIQUID_TAB_PILL_HEIGHT + Math.max(insets.bottom, 12) + 28;

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearShowTimer(), [clearShowTimer]);

  const hide = useCallback(() => {
    if (!enabled) {
      return;
    }

    clearShowTimer();
    if (hiddenRef.current) {
      return;
    }

    hiddenRef.current = true;
    // Drop GlassView before moving it — animating UIGlassEffect causes smear/corruption.
    setGlassSuspended(true);
    requestAnimationFrame(() => {
      Animated.timing(translateY, {
        toValue: hideOffset,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  }, [clearShowTimer, enabled, hideOffset, translateY]);

  /** Hide on content scroll — skip pull-to-refresh / top bounce (y <= 0). */
  const hideFromScroll = useCallback(
    (e: ScrollEvent) => {
      if (e.nativeEvent.contentOffset.y <= 0) {
        return;
      }
      hide();
    },
    [hide],
  );

  const reveal = useCallback(() => {
    if (!enabled) {
      return;
    }

    clearShowTimer();
    hiddenRef.current = false;
    Animated.timing(translateY, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setGlassSuspended(false);
      }
    });
  }, [clearShowTimer, enabled, translateY]);

  const scheduleReveal = useCallback(() => {
    if (!enabled) {
      return;
    }

    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      reveal();
    }, SHOW_DELAY_MS);
  }, [clearShowTimer, enabled, reveal]);

  const scrollProps = useMemo<ScrollProps>(
    () => ({
      onScrollBeginDrag: hideFromScroll,
      onMomentumScrollBegin: hideFromScroll,
      onScrollEndDrag: scheduleReveal,
      onMomentumScrollEnd: scheduleReveal,
    }),
    [hideFromScroll, scheduleReveal],
  );

  const value = useMemo(
    () => ({ translateY, glassSuspended, scrollProps, reveal }),
    [translateY, glassSuspended, scrollProps, reveal],
  );

  return (
    <LiquidTabBarVisibilityContext.Provider value={value}>
      {children}
    </LiquidTabBarVisibilityContext.Provider>
  );
}

export function useLiquidTabBarScrollProps(): Partial<ScrollProps> {
  const ctx = useContext(LiquidTabBarVisibilityContext);
  if (!ctx || !isLiquidUiEnabled()) {
    return {};
  }
  return ctx.scrollProps;
}

export function useLiquidTabBarTranslateY(): Animated.Value | null {
  const ctx = useContext(LiquidTabBarVisibilityContext);
  if (!ctx || !isLiquidUiEnabled()) {
    return null;
  }
  return ctx.translateY;
}

export function useLiquidTabBarGlassSuspended(): boolean {
  const ctx = useContext(LiquidTabBarVisibilityContext);
  return ctx?.glassSuspended ?? false;
}

export function useRevealLiquidTabBar(): () => void {
  const ctx = useContext(LiquidTabBarVisibilityContext);
  return ctx?.reveal ?? (() => {});
}
