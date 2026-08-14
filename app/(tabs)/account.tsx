import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, SegmentedButtons, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CelebrationBurst } from '@/components/celebration-burst';
import { LanguageDropdown } from '@/components/language-dropdown';
import {
  MembershipUpgradeModal,
  type UpgradeContactInfo,
  type UpgradePlan,
} from '@/components/membership-upgrade-modal';
import { useAppStatus } from '@/contexts/app-status-context';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useNetwork } from '@/contexts/network-context';
import { useNotifications } from '@/contexts/notification-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { takeAccountBootstrap } from '@/services/catalog-bootstrap';
import { fetchCustomerProfile } from '@/services/customer-api';
import { fetchMembership, fetchMembershipCoupons } from '@/services/membership-api';
import {
  clearMembershipUpgradePending,
  resolveMembershipUpgradePending,
  setMembershipUpgradePending,
  submitMembershipUpgradeRequest,
} from '@/services/membership-upgrade';
import { clearProductPreviewCache } from '@/services/product-preview-cache';
import type { Membership, MembershipCoupon } from '@/types/membership';
import {
  getCouponEligibilityMessage,
  getCurrentCoupon,
  getMemberTier,
  isCouponAvailable,
  isCouponStatusAvailable,
  isProOrPremiumMember,
} from '@/types/membership';
import { formatPrice } from '@/types/product';

function readAccountSeed() {
  const seed = takeAccountBootstrap();
  if (!seed) {
    return {
      membership: null as Membership | null,
      coupon: null as MembershipCoupon | null,
      hasSeed: false,
    };
  }

  return {
    membership: seed.membership,
    coupon: getCurrentCoupon(seed.coupons, seed.membership),
    hasSeed: true,
  };
}

function RotatingSandTimer({ color, size = 22 }: { color: string; size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <MaterialCommunityIcons name="timer-sand" size={size} color={color} />
    </Animated.View>
  );
}

function getMemberStatusLabel(level: string | undefined, t: (key: string) => string) {
  const tier = getMemberTier(level);

  if (tier === 'premium') {
    return t('account.memberStatusPremium');
  }

  if (tier === 'pro') {
    return t('account.memberStatusPro');
  }

  return t('account.memberStatusRegistered');
}

function resolveContactInfo(
  profile: { name: string; email: string; phone: string } | null,
  user: { name: string; login: string } | null,
): UpgradeContactInfo {
  const login = user?.login?.trim() || '';
  const loginIsEmail = login.includes('@');

  return {
    name: profile?.name || user?.name || '-',
    phone: profile?.phone || (!loginIsEmail ? login : '') || '-',
    email: profile?.email || (loginIsEmail ? login : '') || '-',
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
  const { setSimulateOffline } = useNetwork();
  const { setSimulateServerDown, setSimulateForceUpdate, clearStatusSimulations } = useAppStatus();

  const [accountSeed] = useState(readAccountSeed);
  const [membership, setMembership] = useState<Membership | null>(accountSeed.membership);
  const [coupon, setCoupon] = useState<MembershipCoupon | null>(accountSeed.coupon);
  const [contact, setContact] = useState<UpgradeContactInfo>(() => resolveContactInfo(null, user));
  const [isLoading, setIsLoading] = useState(!accountSeed.hasSeed);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showMembership, setShowMembership] = useState(false);
  const [upgradePending, setUpgradePending] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheMessage, setCacheMessage] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);

  const membershipLevel = membership?.x_studio_membership_level;
  const isPaidMember = isProOrPremiumMember(membershipLevel);
  const showUpgradePending = upgradePending && !isPaidMember;
  const memberStatusLabel = getMemberStatusLabel(membershipLevel, t);

  const loadAccountData = useCallback(async () => {
    if (!token) {
      return;
    }

    const [membershipResult, couponsData, profile, pending] = await Promise.all([
      fetchMembership(token),
      fetchMembershipCoupons(token),
      fetchCustomerProfile(token).catch(() => null),
      resolveMembershipUpgradePending(token),
    ]);

    setMembership(membershipResult.membership);
    setCoupon(getCurrentCoupon(couponsData, membershipResult.membership));
    setContact(resolveContactInfo(profile, user));

    if (isProOrPremiumMember(membershipResult.membership?.x_studio_membership_level)) {
      if (pending) {
        await clearMembershipUpgradePending();
      }
      setUpgradePending(false);
    } else {
      setUpgradePending(!!pending);
    }
  }, [token, user]);

  useEffect(() => {
    loadAccountData()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load account data.');
      })
      .finally(() => setIsLoading(false));
  }, [loadAccountData]);

  useFocusEffect(
    useCallback(() => {
      loadAccountData().catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load account data.');
      });
    }, [loadAccountData]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadAccountData().catch(() => {});
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

  const openUpgradeModal = () => {
    setUpgradeModalVisible(true);
  };

  const closeUpgradeModal = () => {
    if (isSubmittingUpgrade) {
      return;
    }

    setUpgradeModalVisible(false);
  };

  const handleSelectPlan = async (plan: UpgradePlan) => {
    if (!token) {
      setError('Please sign in again.');
      return;
    }

    setIsSubmittingUpgrade(true);
    try {
      await submitMembershipUpgradeRequest({
        token,
        plan,
        name: contact.name !== '-' ? contact.name : user?.name || '',
        phone: contact.phone !== '-' ? contact.phone : '',
        email: contact.email !== '-' ? contact.email : '',
      });
      await setMembershipUpgradePending(plan);
      setUpgradePending(true);
      setUpgradeModalVisible(false);
      setShowCelebration(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit upgrade request.');
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    setCacheMessage('');
    try {
      clearProductPreviewCache();
      await clearMembershipUpgradePending();
      setUpgradePending(false);
      setCacheMessage(t('account.clearCacheDone'));
      await loadAccountData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache.');
    } finally {
      setIsClearingCache(false);
    }
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

          {showUpgradePending ? (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
                {t('account.memberStatus')}
              </Text>
              <View style={[styles.pendingStatusBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={styles.pendingStatusRow}>
                  <RotatingSandTimer color={colors.primary} size={22} />
                  <Text
                    style={[
                      styles.pendingStatusTitle,
                      { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) },
                    ]}>
                    {t('account.upgradeContactSoon')}
                  </Text>
                </View>
                <View style={styles.pendingStatusRow}>
                  <MaterialCommunityIcons name="progress-clock" size={18} color={colors.textMuted} />
                  <Text
                    style={[
                      styles.pendingStatusBody,
                      { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) },
                    ]}>
                    {t('account.upgradeProcessing')}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <InfoRow
              label={t('account.memberStatus')}
              value={memberStatusLabel}
              colors={colors}
              rs={rs}
              fs={fs}
              lh={lh}
            />
          )}

          {!showUpgradePending ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
                {t('account.couponCode')}
              </Text>

              {isPaidMember ? (
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
                      style={[
                        styles.couponText,
                        { color: couponAvailable ? colors.success : colors.danger, fontSize: rs(16) },
                      ]}>
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
                    <Text
                      style={[
                        styles.couponAmount,
                        { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
                      ]}>
                      {t('account.amount')}: {formatPrice(coupon.x_studio_coupon_amount)}
                    </Text>
                  ) : null}
                  {coupon ? (
                    <Text
                      style={[
                        styles.couponAmount,
                        { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
                      ]}>
                      {t('account.status')}: {coupon.x_studio_status}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.couponHint, { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }]}>
                    {couponHint}
                  </Text>

                  {membership && showMembership ? (
                    <View
                      style={[
                        styles.membershipDetails,
                        { borderTopColor: couponAvailable ? colors.success : colors.danger },
                      ]}>
                      <InfoRow
                        label={t('account.level')}
                        value={membership.x_studio_membership_level}
                        colors={colors}
                        rs={rs}
                        fs={fs}
                        lh={lh}
                      />
                      <InfoRow
                        label={t('account.status')}
                        value={membership.x_studio_status}
                        colors={colors}
                        rs={rs}
                        fs={fs}
                        lh={lh}
                      />
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
                          <Text
                            style={[
                              styles.label,
                              { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) },
                            ]}>
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
              ) : (
                <View style={[styles.upgradeBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text
                    style={[
                      styles.upgradeIntro,
                      { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) },
                    ]}>
                    {t('account.upgradeUnlockCoupons')}
                  </Text>

                  <Button
                    mode="contained"
                    onPress={openUpgradeModal}
                    style={styles.upgradeButton}
                    contentStyle={styles.upgradeButtonContent}>
                    {t('account.upgrade')}
                  </Button>
                </View>
              )}
            </>
          ) : null}
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

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
            {t('account.clearCache')}
          </Text>
          <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
            {t('account.clearCacheSubtitle')}
          </Text>
          {cacheMessage ? (
            <Text style={[styles.cacheMessage, { color: colors.success, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
              {cacheMessage}
            </Text>
          ) : null}
          <Button
            mode="outlined"
            icon="cached"
            onPress={handleClearCache}
            loading={isClearingCache}
            disabled={isClearingCache}
            style={styles.clearCacheButton}>
            {t('account.clearCache')}
          </Button>
        </View>

        {__DEV__ ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
              Status testing
            </Text>
            <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
              Preview offline, server crash, and system upgrade popups. Dev only.
            </Text>

            <Button
              mode="contained"
              icon="wifi-off"
              onPress={() => {
                clearStatusSimulations();
                setSimulateOffline(true);
              }}
              style={styles.statusTestButton}>
              Offline popup
            </Button>

            <Button
              mode="contained"
              icon="server-network-off"
              onPress={() => {
                setSimulateOffline(false);
                setSimulateForceUpdate(false);
                setSimulateServerDown(true);
              }}
              style={styles.statusTestButton}>
              Server crash popup
            </Button>

            <Button
              mode="contained"
              icon="cellphone-arrow-down"
              onPress={() => {
                setSimulateOffline(false);
                setSimulateServerDown(false);
                setSimulateForceUpdate(true);
              }}
              style={styles.statusTestButton}>
              System upgrade popup
            </Button>

            <Button
              mode="outlined"
              icon="close-circle-outline"
              onPress={() => {
                setSimulateOffline(false);
                clearStatusSimulations();
              }}
              style={styles.statusTestButton}>
              Clear status tests
            </Button>
          </View>
        ) : null}

        <Button mode="outlined" onPress={signOut} style={styles.logoutButton}>
          {t('account.signOut')}
        </Button>
      </ScrollView>

      <MembershipUpgradeModal
        visible={upgradeModalVisible}
        isSubmitting={isSubmittingUpgrade}
        onClose={closeUpgradeModal}
        onSelectPlan={handleSelectPlan}
      />

      <CelebrationBurst active={showCelebration} onFinished={() => setShowCelebration(false)} />
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
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    marginBottom: 16,
  },
  pendingStatusBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  pendingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingStatusTitle: {
    flex: 1,
    fontWeight: '700',
  },
  pendingStatusBody: {
    flex: 1,
    fontWeight: '500',
  },
  label: {
    marginBottom: 4,
  },
  value: {
    fontWeight: '600',
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
  upgradeBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  upgradeIntro: {
    fontWeight: '500',
  },
  upgradeButton: {
    marginTop: 14,
    borderRadius: 12,
  },
  upgradeButtonContent: {
    paddingVertical: 4,
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
  clearCacheButton: {
    marginTop: 12,
  },
  statusTestButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  cacheMessage: {
    marginTop: 8,
    fontWeight: '600',
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
