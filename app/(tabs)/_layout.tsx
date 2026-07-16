import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';

const TAB_BAR_CONTENT_HEIGHT = 56;

function getAndroidTabBarStyle(colors: ReturnType<typeof useAppColors>, bottomInset: number) {
  const bottomPadding = Math.max(bottomInset, 12);

  return {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.tabBarBorder,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: bottomPadding,
    height: TAB_BAR_CONTENT_HEIGHT + bottomPadding + 6,
  };
}

function CartTabIcon({ color, size }: { color: string; size?: number }) {
  const { totalItems } = useCart();

  return (
    <View>
      <MaterialIcons name="shopping-cart" size={size ?? 24} color={color} />
      {totalItems > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{totalItems > 9 ? '9+' : totalItems}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  if (!user) {
    return <Redirect href="/login" />;
  }

  const tabBarStyle =
    Platform.OS === 'android'
      ? getAndroidTabBarStyle(colors, insets.bottom)
      : {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
        };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle,
        tabBarItemStyle: {
          paddingBottom: Platform.OS === 'android' ? 2 : 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          // Myanmar uses natural metrics; a fixed lineHeight clips Burmese glyphs.
          lineHeight: language === 'my' ? undefined : 16,
          fontWeight: '600',
          marginBottom: Platform.OS === 'android' ? 2 : 0,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.products'),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="inventory-2" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabs.cart'),
          tabBarIcon: ({ color, size }) => <CartTabIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="receipt-long" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabs.account'),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size ?? 24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
