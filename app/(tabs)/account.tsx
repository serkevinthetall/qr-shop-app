import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, SegmentedButtons, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguageDropdown } from '@/components/language-dropdown';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useNotifications } from '@/contexts/notification-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { takeAccountBootstrap } from '@/services/catalog-bootstrap';
import { fetchMembership, fetchMembershipCoupons } from '@/services/membership-api';
import type { Membership, MembershipCoupon } from '@/types/membership';
import {
  getCouponEligibilityMessage,
  getCurrentCoupon,
  getMemberId,
  isCouponAvailable,
  isCouponStatusAvailable,
} from '@/types/membership';
import { formatPrice } from '@/types/product';

function readAccountSeed() {
  const seed = takeAccountBootstrap();
  if (!seed) {
    return {
      membership: null as Membership | null,
      memberCode: '',
      coupon: null as MembershipCoupon | null,
      hasSeed: false,
    };
  }

  return {
    membership: seed.membership,
    memberCode: seed.memberCode,
    coupon: getCurrentCoupon(seed.coupons, seed.membership),
    hasSeed: true,
  };
}

export default function AccountScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { theme, preference, followSystem, setFollowSystem, setPreference } = useThemeMode();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { user, token, signOut } = useAuth();
  const { t, fs, lh } = useLanguage();
  const { unreadCount } = useNotifications();

  const [accountSeed] = useState(readAccountSeed);
  const [membership, setMembership] = useState<Membership | null>(accountSeed.membership);
  const [memberCode, setMemberCode] = useState(accountSeed.memberCode);
  const [coupon, setCoupon] = useState<MembershipCoupon | null>(accountSeed.coupon);
  const [isLoading, setIsLoading] = useState(!accountSeed.hasSeed);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showMembership, setShowMembership] = useState(false);

  const loadAccountData = useCallback(async () => {
    if (!token) {
      return;
    }

    const [membershipResult, couponsData] = await Promise.all([
      fetchMembership(token),
      fetchMembershipCoupons(token),
    ]);

    setMembership(membershipResult.membership);
    setMemberCode(membershipResult.memberCode);
    setCoupon(getCurrentCoupon(couponsData, membershipResult.membership));
  }, [token]);

  useEffect(() => {
    loadAccountData()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load account data.');
      })
      .finally(() => setIsLoading(false));
  }, [loadAccountData]);

  // Silently re-fetch whenever the Account tab regains focus, so membership and
  // coupon changes made in Odoo show up without restarting the app.
  useFocusEffect(
    useCallback(() => {
      loadAccountData().catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load account data.');
      });
    }, [loadAccountData]),
  );

  // Also refresh when the app returns to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadAccountData().catch(() => {
          // Keep showing the last known data if the refresh fails.
        });
      }
    });

    return () => subscription.remove();
  }, [loadAccountData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError('');
    try {
      await loadAccountData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh account data.');
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAccountData]);

  const couponAvailable = coupon ? isCouponAvailable(coupon, membership) : false;

  const couponHint = (() => {
    if (couponAvailable) {
      return copied ? t('account.copied') : t('account.tapToCopy');
    }

    if (coupon && isCouponStatusAvailable(coupon) && membership) {
      return getCouponEligibilityMessage(membership.x_studio_membership_level);
    }

    return coupon?.x_studio_status ?? t('account.unavailable');
  })();

  const handleCopyCoupon = async () => {
    if (!coupon || !couponAvailable) {
      return;
    }

    await Clipboard.setStringAsync(coupon.x_studio_coupon_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }>
        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <InfoRow label={t('account.myName')} value={user?.name ?? '-'} colors={colors} rs={rs} fs={fs} lh={lh} />
          {membership ? (
            <InfoRow
              label={t('account.membership')}
              value={`${membership.x_studio_membership_level} · ${membership.x_studio_status}`}
              colors={colors}
              rs={rs}
              fs={fs}
              lh={lh}
            />
          ) : null}

          <InfoRow label={t('account.memberId')} value={getMemberId(memberCode)} colors={colors} rs={rs} fs={fs} lh={lh} />

          <Text style={[styles.label, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
            {t('account.couponCode')}
          </Text>
          <Pressable
                onPress={handleCopyCoupon}
                disabled={!couponAvailable}
                style={[
                  styles.couponBox,
                  {
                    backgroundColor: couponAvailable ? colors.successBg : colors.dangerBg,
                    borderColor: couponAvailable ? colors.success : colors.danger,
                  },
                ]}>
                <View style={styles.couponTopRow}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[styles.couponText, { color: couponAvailable ? colors.success : colors.danger, fontSize: rs(16) }]}>
                    {coupon?.x_studio_coupon_code ?? t('account.noCoupon')}
                  </Text>
                  {membership ? (
                    <Pressable
                      onPress={() => setShowMembership((value) => !value)}
                      hitSlop={8}
                      style={styles.couponExpand}
                      accessibilityRole="button">
                      <MaterialCommunityIcons
                        name={showMembership ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={couponAvailable ? colors.success : colors.danger}
                      />
                    </Pressable>
                  ) : null}
                </View>
                {coupon ? (
                  <Text style={[styles.couponAmount, { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }]}>
                    {t('account.amount')}: {formatPrice(coupon.x_studio_coupon_amount)}
                  </Text>
                ) : null}
                {coupon ? (
                  <Text style={[styles.couponAmount, { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }]}>
                    {t('account.status')}: {coupon.x_studio_status}
                  </Text>
                ) : null}
                <Text style={[styles.couponHint, { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }]}>{couponHint}</Text>

                {membership && showMembership ? (
                  <View style={[styles.membershipDetails, { borderTopColor: couponAvailable ? colors.success : colors.danger }]}>
                    <InfoRow label={t('account.level')} value={membership.x_studio_membership_level} colors={colors} rs={rs} fs={fs} lh={lh} />
                    <InfoRow label={t('account.status')} value={membership.x_studio_status} colors={colors} rs={rs} fs={fs} lh={lh} />
                    <InfoRow
                      label={t('account.validity')}
                      value={`${membership.x_studio_start_date} → ${membership.x_studio_end_date}`}
                      colors={colors}
                      rs={rs}
                      fs={fs}
                      lh={lh}
                    />
                    <InfoRow
                      label={t('account.monthlyCoupon')}
                      value={formatPrice(membership.x_studio_monthly_coupon_amount)}
                      colors={colors}
                      rs={rs}
                      fs={fs}
                      lh={lh}
                    />
                    <InfoRow
                      label={t('account.tickets')}
                      value={`${membership.x_studio_remaining_tickets}/${membership.x_studio_total_tickets}`}
                      colors={colors}
                      rs={rs}
                      fs={fs}
                      lh={lh}
                    />
                    {membership.x_studio_benefits_summary ? (
                      <View>
                        <Text style={[styles.label, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
                          {t('account.benefits')}
                        </Text>
                        <Text style={[styles.benefitsBody, { color: colors.text, fontSize: fs(rs(14)) }]}>
                          {membership.x_studio_benefits_summary}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>{t('account.myAddresses')}</Text>
          <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
            {t('account.addressesSubtitle')}
          </Text>
          <Button
            mode="contained"
            icon="map-marker"
            onPress={() => router.push('/addresses' as Href)}
            style={styles.addressButton}>
            {t('account.manageAddresses')}
          </Button>
        </View>

        <Pressable
          onPress={() => router.push('/notifications' as Href)}
          style={[styles.card, styles.navRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.navTextWrap}>
            <View style={styles.navTitleRow}>
              <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
                {t('account.notifications')}
              </Text>
              {unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={[styles.badgeText, { color: colors.onPrimary }]}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
              {t('account.notificationsSubtitle')}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/change-password' as Href)}
          style={[styles.card, styles.navRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.navTextWrap}>
            <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
              {t('account.resetPassword')}
            </Text>
            <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
              {t('account.resetPasswordSubtitle')}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
        </Pressable>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
            {t('account.language')}
          </Text>
          <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
            {t('account.languageSubtitle')}
          </Text>
          <LanguageDropdown />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.themeRow}>
            <View style={styles.themeTextWrap}>
              <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
                {t('account.followDeviceTheme')}
              </Text>
              <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
                {followSystem
                  ? t('account.usingPhoneSetting', { theme })
                  : t('account.manualTheme', { theme })}
              </Text>
            </View>
            <Switch value={followSystem} onValueChange={setFollowSystem} />
          </View>

          {!followSystem ? (
            <SegmentedButtons
              value={preference === 'system' ? theme : preference}
              onValueChange={(value) => setPreference(value as 'light' | 'dark')}
              buttons={[
                { value: 'light', label: t('account.themeLight'), icon: 'white-balance-sunny' },
                { value: 'dark', label: t('account.themeDark'), icon: 'weather-night' },
              ]}
              style={styles.segmented}
            />
          ) : null}
        </View>

        <Button mode="outlined" onPress={signOut} style={styles.logoutButton}>
          {t('account.signOut')}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  colors,
  rs,
  fs,
  lh,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppColors>;
  rs: (size: number) => number;
  fs: (size: number) => number;
  lh: (size: number) => number | undefined;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.label, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text, fontSize: fs(rs(18)), lineHeight: lh(18) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  title: {
    fontWeight: '700',
    marginBottom: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 4,
  },
  value: {
    fontWeight: '600',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  codeCol: {
    flex: 1,
  },
  couponBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  couponText: {
    flexShrink: 1,
    fontWeight: '700',
  },
  couponAmount: {
    marginTop: 4,
  },
  couponHint: {
    marginTop: 6,
  },
  couponTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  couponExpand: {
    marginLeft: 4,
  },
  membershipDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  benefitsBody: {
    marginTop: 4,
    fontWeight: '500',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  themeTextWrap: {
    flex: 1,
  },
  themeTitle: {
    fontWeight: '600',
  },
  themeSubtitle: {
    marginTop: 4,
  },
  segmented: {
    marginTop: 16,
  },
  addressButton: {
    marginTop: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navTextWrap: {
    flex: 1,
  },
  navTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 8,
  },
  errorText: {
    marginBottom: 12,
    textAlign: 'center',
  },
});
