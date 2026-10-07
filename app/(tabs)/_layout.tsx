'use no memo';

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { Redirect, Tabs } from 'expo-router';
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/tabs';
import React from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import {
  LiquidTabBarVisibilityProvider,
  useLiquidTabBarGlassSuspended,
  useLiquidTabBarTranslateY,
} from '@/contexts/liquid-tab-bar-visibility';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import {
  isLiquidTabBarEnabled,
  LIQUID_BLUR_INTENSITY,
  liquidTabBarBlurTint,
  liquidTabBarIconActive,
  liquidTabBarIconHaloFill,
  liquidTabBarIconInactive,
  liquidTabBarLabelActive,
  liquidTabBarLabelInactive,
  liquidTabBarSuspendedFill,
  liquidTabBarUnderlay,
  liquidTabBarWash,
} from '@/utils/liquid-ui';

const PILL_HEIGHT = 68;
const PILL_WIDTH_RATIO = 0.8;
const ANDROID_TAB_CONTENT_HEIGHT = 58;
const ICON_SLOT = 28;

function TabIconSlot({ children }: { children: React.ReactNode }) {
  return <View style={styles.iconSlot}>{children}</View>;
}

/** Static teal halo for the focused icon on the floating pill only. */
function TabIconHalo({
  focused,
  enabled,
  isDark,
  children,
}: {
  focused: boolean;
  enabled: boolean;
  isDark: boolean;
  children: React.ReactNode;
}) {
  if (!enabled) {
    return <TabIconSlot>{children}</TabIconSlot>;
  }

  const haloFill = liquidTabBarIconHaloFill(isDark, focused);

  return (
    <View style={[styles.iconHalo, haloFill ? { backgroundColor: haloFill } : null]}>
      {children}
    </View>
  );
}

function CartTabIcon({
  color,
  size,
  focused,
  floating,
  isDark,
}: {
  color: string;
  size?: number;
  focused: boolean;
  floating: boolean;
  isDark: boolean;
}) {
  const { totalItems } = useCart();

  return (
    <TabIconHalo focused={focused} enabled={floating} isDark={isDark}>
      <View style={styles.cartIconWrap}>
        <MaterialIcons name="shopping-cart" size={size ?? 24} color={color} />
        {totalItems > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalItems > 99 ? '99+' : totalItems}</Text>
          </View>
        ) : null}
      </View>
    </TabIconHalo>
  );
}

function TabLabel({
  label,
  focused,
  floating,
  isDark,
  activeColor,
  inactiveColor,
  isMyanmar,
}: {
  label: string;
  focused: boolean;
  floating: boolean;
  isDark: boolean;
  activeColor: string;
  inactiveColor: string;
  isMyanmar: boolean;
}) {
  const color = floating
    ? focused
      ? liquidTabBarLabelActive(isDark)
      : liquidTabBarLabelInactive(isDark)
    : focused
      ? activeColor
      : inactiveColor;

  return (
    <Text
      numberOfLines={1}
      allowFontScaling={false}
      style={[
        styles.tabLabel,
        floating ? styles.tabLabelFloating : styles.tabLabelFlat,
        isMyanmar ? styles.tabLabelMyanmar : null,
        { color },
      ]}>
      {label}
    </Text>
  );
}

/** Frosted pill behind tab icons — iOS floating only (theme-aware). */
function LiquidTabBarBackground() {
  const { isDark } = useThemeMode();
  const glassSuspended = useLiquidTabBarGlassSuspended();

  if (glassSuspended) {
    return (
      <View style={[styles.glassPill, { backgroundColor: liquidTabBarSuspendedFill(isDark) }]} />
    );
  }

  return (
    <View style={styles.glassPill} pointerEvents="none">
      <BlurView
        intensity={LIQUID_BLUR_INTENSITY}
        tint={liquidTabBarBlurTint(isDark)}
        style={styles.glassPillFill}
      />
      <View style={[styles.glassPillFill, { backgroundColor: liquidTabBarUnderlay(isDark) }]} />
      <View style={[styles.glassPillFill, { backgroundColor: liquidTabBarWash(isDark) }]} />
    </View>
  );
}

/** Floating frosted pill — liquid iOS only. */
function LiquidFloatingTabBar(props: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useLiquidTabBarTranslateY();
  const pillWidth = Math.round(width * PILL_WIDTH_RATIO);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.barDock, translateY ? { transform: [{ translateY }] } : null]}>
      <View
        style={[
          styles.barShell,
          {
            width: pillWidth,
            marginBottom: Math.max(insets.bottom, 12),
          },
        ]}>
        <View style={styles.pillShadow} pointerEvents="none" />
        <BottomTabBar
          {...props}
          insets={{ ...props.insets, bottom: 0 }}
          style={{ width: pillWidth, alignSelf: 'center' }}
        />
      </View>
    </Animated.View>
  );
}

function TabLayoutInner() {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const isAndroid = Platform.OS === 'android';
  const isMyanmar = language === 'my';
  // Floating pill only on liquid iOS. Android + older iOS = flat full-width bar.
  const floating = !isAndroid && isLiquidTabBarEnabled();

  if (!user) {
    return <Redirect href="/login" />;
  }

  const activeColor = floating ? liquidTabBarIconActive(isDark) : colors.tabIconSelected;
  const inactiveColor = floating ? liquidTabBarIconInactive(isDark) : colors.tabIconDefault;
  const activeTint = activeColor;
  const inactiveTint = inactiveColor;
  const androidBottomPad = Math.max(insets.bottom, 8);

  const labelFor =
    (key: 'tabs.products' | 'tabs.cart' | 'tabs.orders' | 'tabs.account') =>
    ({ focused }: { focused: boolean }) => (
      <TabLabel
        label={t(key)}
        focused={focused}
        floating={floating}
        isDark={isDark}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
        isMyanmar={isMyanmar}
      />
    );

  return (
    <Tabs
      // Remount on language / theme so pill colors + EN/MY metrics stay correct.
      key={`tabs-${language}-${isDark ? 'dark' : 'light'}-${floating ? 'float' : 'flat'}`}
      tabBar={floating ? (props) => <LiquidFloatingTabBar {...props} /> : undefined}
      screenOptions={{
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: inactiveTint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: isAndroid,
        tabBarStyle: floating
          ? {
              height: PILL_HEIGHT,
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
              paddingTop: 4,
              paddingBottom: 4,
              paddingHorizontal: 8,
            }
          : isAndroid
            ? {
                // Clear chrome vs screen: visible top edge + soft lift so light
                // mode doesn't melt into white cards, dark stays non-ERP.
                backgroundColor: colors.tabBar,
                borderTopColor: colors.tabBarBorder,
                borderTopWidth: 1,
                elevation: 16,
                shadowColor: colors.shadow,
                shadowOpacity: isDark ? 0.45 : 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: -3 },
                height: ANDROID_TAB_CONTENT_HEIGHT + androidBottomPad + (isMyanmar ? 4 : 0),
                paddingTop: 6,
                paddingBottom: androidBottomPad,
              }
            : {
                // Older iOS flat bar — small Myanmar bump so Burmese labels aren't tight.
                backgroundColor: colors.tabBar,
                borderTopColor: colors.tabBarBorder,
                borderTopWidth: StyleSheet.hairlineWidth,
                ...(isMyanmar ? { paddingTop: 4 } : null),
              },
        tabBarBackground: floating ? () => <LiquidTabBarBackground /> : undefined,
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarLabelStyle: {
          marginTop: 2,
          marginBottom: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.products'),
          tabBarLabel: labelFor('tabs.products'),
          tabBarIcon: ({ focused, size }) => (
            <TabIconHalo focused={focused} enabled={floating} isDark={isDark}>
              <MaterialIcons
                name="inventory-2"
                size={size ?? 24}
                color={focused ? activeColor : inactiveColor}
              />
            </TabIconHalo>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabs.cart'),
          tabBarLabel: labelFor('tabs.cart'),
          tabBarIcon: ({ focused, size }) => (
            <CartTabIcon
              color={focused ? activeColor : inactiveColor}
              size={size}
              focused={focused}
              floating={floating}
              isDark={isDark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarLabel: labelFor('tabs.orders'),
          tabBarIcon: ({ focused, size }) => (
            <TabIconHalo focused={focused} enabled={floating} isDark={isDark}>
              <MaterialIcons
                name="receipt-long"
                size={size ?? 24}
                color={focused ? activeColor : inactiveColor}
              />
            </TabIconHalo>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarLabel: labelFor('tabs.account'),
          tabBarIcon: ({ focused, size }) => (
            <TabIconHalo focused={focused} enabled={floating} isDark={isDark}>
              <MaterialIcons
                name="person"
                size={size ?? 24}
                color={focused ? activeColor : inactiveColor}
              />
            </TabIconHalo>
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (Platform.OS === 'android') {
    return <TabLayoutInner />;
  }

  return (
    <LiquidTabBarVisibilityProvider>
      <TabLayoutInner />
    </LiquidTabBarVisibilityProvider>
  );
}

const styles = StyleSheet.create({
  barDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  barShell: {
    borderRadius: 999,
    overflow: 'visible',
  },
  pillShadow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.01)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  glassPill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    overflow: 'hidden',
  },
  glassPillFill: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
  },
  iconSlot: {
    width: ICON_SLOT,
    height: ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHalo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
    ...(Platform.OS === 'android' ? { textAlignVertical: 'center' as const } : null),
  },
  tabLabelFloating: {
    fontSize: 10,
    marginTop: 1,
  },
  tabLabelFlat: {
    fontSize: 12,
    marginTop: 2,
  },
  tabLabelMyanmar: {
    fontSize: 11,
    // Natural metrics — fixed lineHeight clips Burmese; keep block centered via icon slot.
    lineHeight: undefined,
    paddingTop: Platform.OS === 'android' ? 1 : 0,
  },
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    minHeight: 16,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#ef4444',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
