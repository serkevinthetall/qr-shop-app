import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button, SegmentedButtons, Switch } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TabAppToast } from '@/components/app-toast';
import { FacebookLogo, ViberLogo } from '@/components/brand-logos';
import { CelebrationBurst } from '@/components/celebration-burst';
import { InlineErrorBanner } from '@/components/inline-error-banner';
import { LanguageDropdown } from '@/components/language-dropdown';
import { LiquidSurface } from '@/components/liquid-surface';
import {
  MembershipUpgradeModal,
  type UpgradeContactInfo,
  type UpgradePlan,
} from '@/components/membership-upgrade-modal';
import {
  SUPPORT_CONFIG,
  openExternalUrl,
  openFacebookPage,
  openViberChat,
} from '@/constants/support';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useLiquidTabBarScrollProps } from '@/contexts/liquid-tab-bar-visibility';
import { useNotifications } from '@/contexts/notification-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { takeAccountBootstrap } from '@/services/catalog-bootstrap';
import { getUserFacingError } from '@/services/auth-error';
import { fetchCustomerProfile } from '@/services/customer-api';
import { fetchMembership, fetchMembershipCoupons } from '@/services/membership-api';
import {
  clearMembershipUpgradePending,
  resolveMembershipUpgradePending,
  setMembershipUpgradePending,
  submitMembershipUpgradeRequest,
} from '@/services/membership-upgrade';
import { openStoreReviewPage } from '@/services/store-review';
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
import { hapticLight, hapticSuccess, withHapticPress } from '@/utils/haptics';
import {
  isLiquidUiEnabled,
  liquidGlassBorder,
  liquidGlassFill,
  liquidGlassTint,
} from '@/utils/liquid-ui';

const ACCOUNT_SYNC_INTERVAL_MS = 20000;

function formatSupportPhone(display: string) {
  const digits = display.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('09')) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return display;
}

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
  const { theme, preference, followSystem, setFollowSystem, setPreference, isDark } = useThemeMode();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { user, token, signOut } = useAuth();
  const { t, fs, lh } = useLanguage();
  const { unreadCount } = useNotifications();
  const tabBarScrollProps = useLiquidTabBarScrollProps();
  const liquid = isLiquidUiEnabled();
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;
  const nestedFill = liquid ? liquidGlassFill(isDark) : colors.inputBg;

  const [accountSeed] = useState(readAccountSeed);
  const [membership, setMembership] = useState<Membership | null>(accountSeed.membership);
  const [coupon, setCoupon] = useState<MembershipCoupon | null>(accountSeed.coupon);
  const [contact, setContact] = useState<UpgradeContactInfo>(() => resolveContactInfo(null, user));
  const [isLoading, setIsLoading] = useState(!accountSeed.hasSeed);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [phoneActionsVisible, setPhoneActionsVisible] = useState(false);
  const [phoneToast, setPhoneToast] = useState('');
  const [showMembership, setShowMembership] = useState(false);
  const [upgradePending, setUpgradePending] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false);
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
      // Odoo application Requested → Processing; none / closed → Registered (+ Apply).
      setUpgradePending(!!pending);
    }
  }, [token, user]);

  useEffect(() => {
    loadAccountData()
      .catch((err) => {
        const message = getUserFacingError(err, t('errors.loadAccount'), t);
        if (message) setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [loadAccountData]);

  // Keep membership + Apply status in sync while Account is open (no pull-to-refresh needed).
  useFocusEffect(
    useCallback(() => {
      const syncQuietly = () => {
        loadAccountData().catch(() => {});
      };

      syncQuietly();
      const intervalId = setInterval(syncQuietly, ACCOUNT_SYNC_INTERVAL_MS);

      return () => clearInterval(intervalId);
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
      const message = getUserFacingError(err, t('errors.refreshAccount'), t);
      if (message) setError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAccountData, t]);

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
      setError(t('errors.signInAgain'));
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
      const message = getUserFacingError(err, t('errors.upgradeFailed'), t);
      if (message) setError(message);
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

  const openSupportChannel = useCallback(
    async (kind: 'call' | 'viber' | 'facebook') => {
      hapticLight();
      let opened = false;
      if (kind === 'call') {
        opened = await openExternalUrl(SUPPORT_CONFIG.phoneTel);
      } else if (kind === 'viber') {
        opened = await openViberChat();
      } else {
        opened = await openFacebookPage();
      }
      if (!opened) {
        setError(t('account.helpOpenFailed'));
      }
    },
    [t],
  );

  const handleCopyPhone = useCallback(async () => {
    await Clipboard.setStringAsync(SUPPORT_CONFIG.phoneDisplay);
    hapticSuccess();
    setPhoneActionsVisible(false);
    setPhoneToast(t('account.copied'));
  }, [t]);

  const handleCallPhone = useCallback(() => {
    setPhoneActionsVisible(false);
    void openSupportChannel('call');
  }, [openSupportChannel]);

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
        {...tabBarScrollProps}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }>
        {error ? (
          <InlineErrorBanner
            message={error}
            onRetry={() => {
              void handleRefresh();
            }}
            onDismiss={() => setError('')}
            retrying={isRefreshing}
            style={styles.errorBanner}
          />
        ) : null}

        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
          <InfoRow label={t('account.myName')} value={user?.name ?? '-'} colors={colors} rs={rs} fs={fs} lh={lh} />

          {showUpgradePending ? (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
                {t('account.memberStatus')}
              </Text>
              <View style={[styles.pendingStatusBox, { backgroundColor: nestedFill, borderColor: cardBorder }]}>
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
                <View style={[styles.upgradeBox, { backgroundColor: nestedFill, borderColor: cardBorder }]}>
                  <Text
                    style={[
                      styles.upgradeIntro,
                      { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) },
                    ]}>
                    {t('account.upgradeUnlockCoupons')}
                  </Text>

                  <Button
                    mode="contained"
                    onPress={withHapticPress(openUpgradeModal)}
                    style={styles.upgradeButton}
                    contentStyle={styles.upgradeButtonContent}>
                    {t('account.upgrade')}
                  </Button>
                </View>
              )}
            </>
          ) : null}
        </LiquidSurface>

        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
          <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>{t('account.myAddresses')}</Text>
          <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
            {t('account.addressesSubtitle')}
          </Text>
          <Button
            mode="contained"
            icon="map-marker"
            onPress={withHapticPress(() => router.push('/addresses' as Href))}
            style={styles.addressButton}>
            {t('account.manageAddresses')}
          </Button>
        </LiquidSurface>

        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
          <Pressable
            onPress={withHapticPress(() => router.push('/notifications' as Href))}
            style={styles.navRow}>
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
        </LiquidSurface>

        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
          <Pressable
            onPress={withHapticPress(() => router.push('/change-password' as Href))}
            style={styles.navRow}>
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
        </LiquidSurface>

        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
          <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
            {t('account.language')}
          </Text>
          <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
            {t('account.languageSubtitle')}
          </Text>
          <LanguageDropdown />
        </LiquidSurface>

        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
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
        </LiquidSurface>

        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
          <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
            {t('account.needHelp')}
          </Text>
          <Text
            style={[
              styles.themeSubtitle,
              styles.helpSubtitle,
              { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) },
            ]}>
            {t('account.needHelpSubtitle')}
          </Text>

          <View style={styles.helpActionsRow}>
            {(
              [
                {
                  key: 'call' as const,
                  label: t('account.helpCall'),
                },
                {
                  key: 'viber' as const,
                  label: t('account.helpViber'),
                },
                {
                  key: 'facebook' as const,
                  label: t('account.helpFacebook'),
                },
              ] as const
            ).map((action) => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                accessibilityLabel={
                  action.key === 'call'
                    ? `${action.label}. ${formatSupportPhone(SUPPORT_CONFIG.phoneDisplay)}`
                    : action.label
                }
                onPress={() => {
                  if (action.key === 'call') {
                    hapticLight();
                    setPhoneActionsVisible(true);
                    return;
                  }
                  void openSupportChannel(action.key);
                }}
                style={({ pressed }) => [styles.helpAction, pressed && styles.helpActionPressed]}>
                <View
                  style={[
                    styles.helpActionIconWell,
                    {
                      backgroundColor:
                        action.key === 'call'
                          ? nestedFill
                          : action.key === 'viber'
                            ? 'rgba(115, 96, 242, 0.12)'
                            : 'rgba(24, 119, 242, 0.12)',
                    },
                  ]}>
                  {action.key === 'call' ? (
                    <MaterialCommunityIcons name="phone" size={22} color={colors.primary} />
                  ) : action.key === 'viber' ? (
                    <ViberLogo size={26} />
                  ) : (
                    <FacebookLogo size={26} />
                  )}
                </View>
                <Text
                  style={[
                    styles.helpActionLabel,
                    { color: colors.text, fontSize: fs(rs(12)), lineHeight: lh(12) },
                  ]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </LiquidSurface>

        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive>
          <Pressable
            onPress={withHapticPress(() => {
              void openStoreReviewPage();
            })}
            style={styles.navRow}>
            <View style={styles.navTextWrap}>
              <View style={styles.navTitleRow}>
                <MaterialCommunityIcons name="star-outline" size={20} color={colors.primary} />
                <Text style={[styles.themeTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
                  {t('account.rateStore')}
                </Text>
              </View>
              <Text style={[styles.themeSubtitle, { color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }]}>
                {t('account.rateStoreSubtitle')}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>
        </LiquidSurface>

        <LiquidSurface
          style={[styles.logoutShell, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          cornerRadius={12}
          glassStyle="regular"
          interactive>
          <Button
            mode="text"
            icon="logout"
            textColor={colors.danger}
            onPress={withHapticPress(signOut, 'medium')}
            style={styles.logoutButton}
            contentStyle={styles.logoutButtonContent}>
            {t('account.signOut')}
          </Button>
        </LiquidSurface>
      </ScrollView>

      <MembershipUpgradeModal
        visible={upgradeModalVisible}
        isSubmitting={isSubmittingUpgrade}
        onClose={closeUpgradeModal}
        onSelectPlan={handleSelectPlan}
      />

      <Modal
        visible={phoneActionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhoneActionsVisible(false)}>
        <View style={styles.phoneSheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPhoneActionsVisible(false)} />
          <LiquidSurface
            style={[
              styles.phoneSheetCard,
              {
                borderColor: liquid
                  ? liquidGlassBorder(isDark)
                  : isDark
                    ? 'rgba(67, 189, 182, 0.5)'
                    : 'rgba(13, 148, 136, 0.4)',
              },
            ]}
            backgroundColor={isDark ? '#1A3D3A' : '#E6F7F5'}
            tintColor={liquid ? liquidGlassTint(isDark) : undefined}
            glassStyle="regular"
            interactive
            cornerRadius={18}>
            {/* Cross sits in its own top row — not aligned with Call/Copy icons. */}
            <View style={styles.phoneSheetHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                hitSlop={10}
                onPress={() => setPhoneActionsVisible(false)}
                style={styles.phoneSheetClose}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text
              style={[
                styles.phoneSheetNumber,
                { color: colors.text, fontSize: fs(rs(22)), lineHeight: lh(22) },
              ]}>
              {formatSupportPhone(SUPPORT_CONFIG.phoneDisplay)}
            </Text>

            <View style={styles.phoneSheetActionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('account.helpCall')}
                onPress={handleCallPhone}
                style={({ pressed }) => [styles.phoneSheetIconAction, pressed && styles.phoneSheetIconPressed]}>
                <View style={[styles.phoneSheetIconWell, { backgroundColor: nestedFill }]}>
                  <MaterialCommunityIcons name="phone" size={26} color={colors.primary} />
                </View>
                <Text
                  style={[
                    styles.phoneSheetActionLabel,
                    { color: colors.text, fontSize: fs(rs(13)), lineHeight: lh(13) },
                  ]}>
                  {t('account.helpCall')}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('account.helpCopyNumber')}
                onPress={() => {
                  void handleCopyPhone();
                }}
                style={({ pressed }) => [styles.phoneSheetIconAction, pressed && styles.phoneSheetIconPressed]}>
                <View style={[styles.phoneSheetIconWell, { backgroundColor: nestedFill }]}>
                  <MaterialCommunityIcons name="content-copy" size={26} color={colors.primary} />
                </View>
                <Text
                  style={[
                    styles.phoneSheetActionLabel,
                    { color: colors.text, fontSize: fs(rs(13)), lineHeight: lh(13) },
                  ]}>
                  {t('account.helpCopyNumber')}
                </Text>
              </Pressable>
            </View>
          </LiquidSurface>
        </View>
      </Modal>

      <TabAppToast
        message={phoneToast}
        visible={!!phoneToast}
        onDismiss={() => setPhoneToast('')}
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
    paddingBottom: 120,
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
  helpSubtitle: {
    marginBottom: 14,
  },
  phoneSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  phoneSheetCard: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    zIndex: 1,
    alignItems: 'center',
  },
  phoneSheetHeader: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 36,
    marginBottom: 4,
  },
  phoneSheetClose: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneSheetNumber: {
    textAlign: 'center',
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  phoneSheetActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  phoneSheetIconAction: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 96,
    paddingVertical: 4,
  },
  phoneSheetIconPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  phoneSheetIconWell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneSheetActionLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  helpActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  helpAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  helpActionPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  helpActionIconWell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpActionLabel: {
    fontWeight: '600',
    textAlign: 'center',
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
  logoutShell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  logoutButton: {
    marginTop: 0,
  },
  logoutButtonContent: {
    minHeight: 48,
  },
  errorBanner: {
    marginHorizontal: 0,
  },
});
