import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useWebNav } from '@/contexts/web-nav-context';
import { useResponsive } from '@/hooks/use-responsive';

const LOGO_LIGHT = require('@/assets/images/icon.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');

type NavItem = {
  href: string;
  labelKey: 'tabs.products' | 'tabs.cart' | 'tabs.orders' | 'tabs.account' | 'account.notifications';
  icon: ComponentProps<typeof MaterialIcons>['name'];
  match: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/(tabs)', labelKey: 'tabs.products', icon: 'inventory-2', match: '/' },
  { href: '/(tabs)/cart', labelKey: 'tabs.cart', icon: 'shopping-cart', match: '/cart' },
  { href: '/(tabs)/orders', labelKey: 'tabs.orders', icon: 'receipt-long', match: '/orders' },
  {
    href: '/notifications',
    labelKey: 'account.notifications',
    icon: 'notifications-none',
    match: '/notifications',
  },
  { href: '/(tabs)/account', labelKey: 'tabs.account', icon: 'person', match: '/account' },
];

function isActive(pathname: string, match: string) {
  if (match === '/') {
    return (
      pathname === '/' ||
      pathname === '/index' ||
      pathname.endsWith('/(tabs)') ||
      pathname.endsWith('/(tabs)/') ||
      pathname.endsWith('/(tabs)/index')
    );
  }
  return pathname.includes(match);
}

/** Website-only hamburger drawer. Native app never shows this. */
export function WebNavDrawer() {
  const { isOpen, close } = useWebNav();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isWebsiteLayout, isDesktop } = useResponsive();
  const drawerWidth = isDesktop ? 300 : 280;

  useEffect(() => {
    if (!isWebsiteLayout && isOpen) close();
  }, [isWebsiteLayout, isOpen, close]);

  if (!isWebsiteLayout || !isOpen) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.row}>
        <View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              backgroundColor: colors.surface,
              borderRightColor: colors.border,
              paddingTop: Math.max(insets.top, 20),
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}>
          <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
            <Image
              source={isDark ? LOGO_DARK : LOGO_LIGHT}
              accessibilityLabel="QR Shop Myanmar"
              style={{ width: 48, height: 48 }}
              resizeMode="contain"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('web.closeMenu')}
              onPress={close}
              style={[styles.closeBtn, { backgroundColor: colors.inputBg }]}>
              <MaterialIcons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('web.browse')}</Text>

          <View style={styles.navList}>
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.match);
              return (
                <Pressable
                  key={item.href}
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    requestAnimationFrame(() => router.push(item.href as never));
                  }}
                  style={[
                    styles.navItem,
                    active ? { backgroundColor: colors.primaryMuted } : null,
                  ]}>
                  <MaterialIcons
                    name={item.icon}
                    size={20}
                    color={active ? colors.primary : colors.tabIconDefault}
                  />
                  <Text
                    style={[
                      styles.navLabel,
                      { color: active ? colors.primary : colors.text },
                    ]}>
                    {t(item.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            {user ? (
              <Pressable
                style={styles.navItem}
                onPress={async () => {
                  close();
                  await signOut();
                }}>
                <MaterialIcons name="logout" size={20} color={colors.danger} />
                <Text style={[styles.navLabel, { color: colors.danger }]}>{t('web.signOut')}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.signInBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  close();
                  router.push('/login');
                }}>
                <Text style={[styles.signInText, { color: colors.onPrimary }]}>{t('web.signIn')}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('web.closeMenu')}
          style={styles.backdrop}
          onPress={close}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  drawer: {
    height: '100%',
    maxWidth: '85%',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  sectionLabel: {
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  navList: {
    flex: 1,
    paddingHorizontal: 12,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  signInBtn: {
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  signInText: {
    fontSize: 14,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
