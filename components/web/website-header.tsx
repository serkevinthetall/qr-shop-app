import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { LanguageToggleChip } from '@/components/language-toggle-chip';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useWebNav } from '@/contexts/web-nav-context';
import { useResponsive } from '@/hooks/use-responsive';

const LOGO_LIGHT = require('@/assets/images/icon.png');
const LOGO_DARK = require('@/assets/images/logo-dark.png');

const WEB_NAV_LINKS = [
  { labelKey: 'tabs.products' as const, href: '/(tabs)' },
  { labelKey: 'tabs.cart' as const, href: '/(tabs)/cart' },
  { labelKey: 'tabs.orders' as const, href: '/(tabs)/orders' },
  { labelKey: 'tabs.account' as const, href: '/(tabs)/account' },
];

/**
 * Website-only top bar (browser ≥ 768). Renders nothing on the native app
 * and on narrow browser (phone UI keeps bottom tabs).
 */
export function WebsiteHeader() {
  const router = useRouter();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { t } = useLanguage();
  const { toggle } = useWebNav();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const { isWebsiteLayout, isDesktop, horizontalPadding, contentMaxWidth, showHamburger } =
    useResponsive();

  if (!isWebsiteLayout) {
    return null;
  }

  const showInlineNav = isDesktop;
  const logoSize = isDesktop ? 44 : 40;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}>
      <View
        style={[
          styles.inner,
          {
            maxWidth: contentMaxWidth,
            paddingHorizontal: horizontalPadding,
          },
        ]}>
        <View style={styles.left}>
          {showHamburger && !showInlineNav ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('web.openMenu')}
              onPress={toggle}
              style={styles.iconBtn}>
              <MaterialIcons name="menu" size={24} color={colors.text} />
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="QR Shop Myanmar"
            onPress={() => router.push('/(tabs)')}
            style={styles.brand}>
            <Image
              source={isDark ? LOGO_DARK : LOGO_LIGHT}
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
            />
            <Text style={[styles.brandText, { color: colors.text }]} numberOfLines={1}>
              QR Shop
            </Text>
          </Pressable>
        </View>

        {showInlineNav ? (
          <View style={styles.navLinks}>
            {WEB_NAV_LINKS.map((link) => (
              <Pressable
                key={link.href}
                onPress={() => router.push(link.href as never)}
                style={styles.navLink}>
                <Text style={[styles.navLinkText, { color: colors.textMuted }]}>{t(link.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.flexSpacer} />
        )}

        <View style={styles.right}>
          <LanguageToggleChip
            style={[styles.langChip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('account.notifications')}
            onPress={() => router.push('/notifications')}
            style={styles.iconBtn}>
            <MaterialIcons name="notifications-none" size={22} color={colors.text} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tabs.cart')}
            onPress={() => router.push('/(tabs)/cart')}
            style={styles.iconBtn}>
            <MaterialIcons name="shopping-cart" size={22} color={colors.text} />
            {totalItems > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                <Text style={styles.badgeText}>{totalItems > 99 ? '99+' : totalItems}</Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(user ? '/(tabs)/account' : '/login')}
            style={styles.accountBtn}>
            <Text style={[styles.accountText, { color: colors.text }]}>
              {user ? t('tabs.account') : t('web.signIn')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    zIndex: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 44,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    fontSize: 17,
    fontWeight: '700',
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 1,
  },
  navLink: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  navLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  flexSpacer: {
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  langChip: {
    marginRight: 2,
  },
  badge: {
    position: 'absolute',
    right: 4,
    top: 4,
    minHeight: 16,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  accountBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  accountText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
