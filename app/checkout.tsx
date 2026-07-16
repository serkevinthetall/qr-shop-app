import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
// Wire transfer / KPay — re-enable when payment screenshot flow is turned back on.
// import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  findNodeHandle,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Button, Checkbox, HelperText, RadioButton } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AddressCheckoutSection,
  type AddressCheckoutHandle,
} from '@/components/checkout/address-section';
import { DatePickerField } from '@/components/date-picker-field';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';

// const KPAY_QR_IMAGE = require('@/assets/images/kpay-qr.png');
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { checkoutOrder } from '@/services/order-api';
import { fetchMembership, fetchMembershipCoupons } from '@/services/membership-api';
import {
  getCouponEligibilityMessage,
  getCurrentCoupon,
  isCouponAvailable,
  isCouponStatusAvailable,
  isOrderTotalEligibleForCoupon,
} from '@/types/membership';
import type { Membership, MembershipCoupon } from '@/types/membership';
import { formatPrice } from '@/types/product';

// Keep wire_transfer in the type for when KPay / wire transfer is re-enabled.
type PaymentMethod = 'cod' | 'wire_transfer';

export default function CheckoutScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { token } = useAuth();
  const { items, totalAmount, clearCart } = useCart();
  const { t, fs, lh } = useLanguage();
  const addressRef = useRef<AddressCheckoutHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const notesFieldRef = useRef<View>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const handleAddressError = useCallback((message: string) => {
    setError(message);
  }, []);

  const handleAddressSelectionChange = useCallback((addressId: number | null) => {
    setSelectedAddressId(addressId);
  }, []);

  const [membership, setMembership] = useState<Membership | null>(null);
  const [availableCoupon, setAvailableCoupon] = useState<MembershipCoupon | null>(null);
  const [useCoupon, setUseCoupon] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  // const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = useMemo(() => new Date(), []);

  const scrollNotesIntoView = useCallback(() => {
    const delay = Platform.OS === 'ios' ? 280 : 120;

    setTimeout(() => {
      const scrollHandle = findNodeHandle(scrollRef.current);
      const fieldHandle = findNodeHandle(notesFieldRef.current);

      if (!scrollHandle || !fieldHandle) {
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }

      UIManager.measureLayout(
        fieldHandle,
        scrollHandle,
        () => {
          scrollRef.current?.scrollToEnd({ animated: true });
        },
        (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
        },
      );
    }, delay);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    Promise.all([fetchMembership(token), fetchMembershipCoupons(token)])
      .then(([membershipResult, coupons]) => {
        setMembership(membershipResult.membership);
        setAvailableCoupon(getCurrentCoupon(coupons, membershipResult.membership));
        setUseCoupon(false);
      })
      .catch(() => {
        // Coupon is optional at checkout.
      });
  }, [token]);

  const couponAvailable = availableCoupon
    ? isCouponAvailable(availableCoupon, membership)
    : false;

  const couponTooLow =
    !!availableCoupon &&
    couponAvailable &&
    !isOrderTotalEligibleForCoupon(totalAmount, availableCoupon.x_studio_coupon_amount);

  useEffect(() => {
    if (couponTooLow && useCoupon) {
      setUseCoupon(false);
    }
  }, [couponTooLow, useCoupon]);

  const couponHint = (() => {
    if (!availableCoupon) {
      return t('checkout.couponHintNone');
    }

    if (couponAvailable) {
      return useCoupon
        ? t('checkout.couponHintApply')
        : t('checkout.couponHintSelect');
    }

    if (isCouponStatusAvailable(availableCoupon) && membership) {
      return getCouponEligibilityMessage(membership.x_studio_membership_level);
    }

    return availableCoupon.x_studio_status;
  })();

  /*
  const pickScreenshot = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(t('checkout.errorPhotoPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setScreenshotUri(result.assets[0].uri);
      setError('');
    }
  };
  */

  const handleCheckout = async () => {
    if (!token) {
      setError(t('checkout.errorNotSignedIn'));
      return;
    }

    if (!items.length) {
      setError(t('checkout.errorEmptyCart'));
      return;
    }

    /*
    if (paymentMethod === 'wire_transfer' && !screenshotUri) {
      setError(t('checkout.errorUploadScreenshot'));
      return;
    }
    */

    if (useCoupon && couponTooLow) {
      setError(t('checkout.couponTooLow'));
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const addressId =
        selectedAddressId ?? (await addressRef.current?.resolveAddressId());

      if (!addressId) {
        throw new Error(t('checkout.errorSelectAddress'));
      }

      await checkoutOrder(token, {
        paymentMethod,
        preferredDeliveryDate,
        deliveryNotes,
        addressId: String(addressId),
        couponCode: useCoupon && couponAvailable ? availableCoupon!.x_studio_coupon_code : '',
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        /*
        paymentScreenshot:
          paymentMethod === 'wire_transfer' && screenshotUri
            ? {
                uri: screenshotUri,
                name: 'payment_screenshot.jpg',
                type: 'image/jpeg',
              }
            : undefined,
        */
      });

      clearCart();
      router.replace('/(tabs)/orders' as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('checkout.errorCheckoutFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingHorizontal: horizontalPadding,
          },
        ]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs(rs(20)), lineHeight: lh(20) }]} numberOfLines={1}>
          {t('checkout.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
            paddingBottom: Math.max(24, insets.bottom + 16),
          },
        ]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>{t('checkout.orderSummary')}</Text>

          {items.map((item) => {
            const lineTotal = item.product.list_price * item.quantity;

            return (
              <View
                key={item.product.id}
                style={[styles.summaryLine, { borderBottomColor: colors.border }]}>
                <Text
                  style={[styles.summaryLineName, { color: colors.text, fontSize: fs(15), lineHeight: lh(15) }]}
                  numberOfLines={2}>
                  {item.product.name}
                </Text>
                <Text style={[styles.summaryLineMeta, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>
                  {t('orderDetail.qty')}: {item.quantity} × {formatPrice(item.product.list_price)}
                </Text>
                <Text style={[styles.summaryLineTotal, { color: colors.primary, fontSize: fs(15), lineHeight: lh(15) }]}>
                  {formatPrice(lineTotal)}
                </Text>
              </View>
            );
          })}

          <View style={[styles.summaryDivider, { borderTopColor: colors.border }]} />
          <View style={styles.summaryTotalRow}>
            <Text style={[styles.summaryTotalLabel, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>
              {t('common.total')}
            </Text>
            <Text style={[styles.total, { color: colors.primary, fontSize: fs(22), lineHeight: lh(22) }]}>
              {formatPrice(totalAmount)}
            </Text>
          </View>
        </View>

        {token ? (
          <AddressCheckoutSection
            ref={addressRef}
            token={token}
            onError={handleAddressError}
            onSelectionChange={handleAddressSelectionChange}
          />
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>{t('checkout.couponCode')}</Text>

          <View
            style={[
              styles.couponBox,
              {
                backgroundColor: couponAvailable ? colors.successBg : colors.dangerBg,
                borderColor: couponAvailable ? colors.success : colors.danger,
              },
            ]}>
            <Text
              style={[
                styles.couponCode,
                { color: couponAvailable ? colors.success : colors.danger, fontSize: fs(rs(16)), lineHeight: lh(16) },
              ]}>
              {availableCoupon?.x_studio_coupon_code ?? t('checkout.noCoupon')}
            </Text>
            {availableCoupon ? (
              <Text style={[styles.couponAmount, { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }]}>
                {t('checkout.amount')}: {formatPrice(availableCoupon.x_studio_coupon_amount)}
              </Text>
            ) : null}
            {availableCoupon ? (
              <Text style={[styles.couponAmount, { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }]}>
                {t('checkout.status')}: {availableCoupon.x_studio_status}
              </Text>
            ) : null}
          </View>

          {couponAvailable ? (
            <Pressable
              onPress={() => {
                if (couponTooLow) {
                  return;
                }
                setUseCoupon((current) => !current);
              }}
              style={[styles.couponSelectRow, couponTooLow && styles.couponSelectRowDisabled]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useCoupon, disabled: couponTooLow }}>
              <Checkbox
                status={useCoupon ? 'checked' : 'unchecked'}
                disabled={couponTooLow}
                onPress={() => {
                  if (couponTooLow) {
                    return;
                  }
                  setUseCoupon((current) => !current);
                }}
              />
              <Text style={[styles.couponSelectLabel, { color: colors.text, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
                {t('checkout.useCoupon')}
              </Text>
            </Pressable>
          ) : null}

          {couponTooLow ? (
            <HelperText type="info" visible>
              {t('checkout.couponMinOrder', {
                amount: formatPrice(availableCoupon!.x_studio_coupon_amount),
              })}
            </HelperText>
          ) : (
            <HelperText type="info" visible>
              {couponHint}
            </HelperText>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>{t('checkout.paymentMethod')}</Text>

          <RadioButton.Group
            onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
            value={paymentMethod}>
            <View style={styles.radioRow}>
              <RadioButton value="cod" />
              <Text style={{ color: colors.text, fontSize: fs(15), lineHeight: lh(15) }}>{t('checkout.cod')}</Text>
            </View>
            {/*
            <View style={styles.radioRow}>
              <RadioButton value="wire_transfer" />
              <Text style={{ color: colors.text, fontSize: fs(15), lineHeight: lh(15) }}>{t('checkout.wireTransfer')}</Text>
            </View>
            */}
          </RadioButton.Group>
        </View>

        {/*
        {paymentMethod === 'wire_transfer' ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>{t('checkout.kpayPayment')}</Text>

            <View style={[styles.qrWrap, { backgroundColor: colors.inputBg }]}>
              <Image source={KPAY_QR_IMAGE} style={styles.kpayQrImage} resizeMode="contain" />
            </View>

            <Button mode="outlined" icon="camera" onPress={pickScreenshot} style={styles.uploadButton}>
              {screenshotUri ? t('checkout.changeScreenshot') : t('checkout.uploadScreenshot')}
            </Button>

            {screenshotUri ? (
              <Image source={{ uri: screenshotUri }} style={styles.previewImage} resizeMode="cover" />
            ) : null}
          </View>
        ) : null}
        */}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <DatePickerField
            label={t('checkout.preferredDeliveryDate')}
            value={preferredDeliveryDate}
            onChange={setPreferredDeliveryDate}
            minimumDate={today}
            placeholder={t('checkout.selectDate')}
          />
          <View
            ref={notesFieldRef}
            style={[
              styles.notesField,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}>
            <Text
              style={[
                styles.notesLabel,
                { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
              ]}>
              {t('checkout.deliveryNotes')}
            </Text>
            <TextInput
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              onFocus={scrollNotesIntoView}
              placeholder={t('checkout.deliveryNotesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              blurOnSubmit
              style={[
                styles.notesInput,
                {
                  color: colors.text,
                  fontSize: 15,
                },
              ]}
            />
          </View>
        </View>

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleCheckout}
          loading={isSubmitting}
          disabled={isSubmitting || (useCoupon && couponTooLow)}
          contentStyle={styles.submitButton}>
          {t('checkout.placeOrder')}
        </Button>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  summaryLine: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryLineName: {
    fontWeight: '600',
  },
  summaryLineMeta: {
    marginTop: 4,
  },
  summaryLineTotal: {
    marginTop: 6,
    fontWeight: '700',
    textAlign: 'right',
  },
  summaryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginBottom: 12,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTotalLabel: {
    fontWeight: '600',
  },
  meta: {
    fontSize: 14,
  },
  total: {
    fontWeight: '700',
  },
  input: {
    marginBottom: 8,
  },
  notesField: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    marginBottom: 8,
  },
  notesLabel: {
    marginBottom: 4,
  },
  notesInput: {
    height: 22,
    padding: 0,
    margin: 0,
  },
  couponBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  couponCode: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  couponAmount: {
    marginTop: 6,
  },
  couponSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  couponSelectRowDisabled: {
    opacity: 0.5,
  },
  couponSelectLabel: {
    flex: 1,
    marginLeft: 4,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  /*
  qrWrap: {
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#f7f8f7',
    padding: 12,
    marginTop: 12,
    overflow: 'hidden',
  },
  kpayQrImage: {
    width: '100%',
    maxWidth: 280,
    height: 360,
  },
  uploadButton: {
    marginTop: 16,
  },
  previewImage: {
    width: '100%',
    height: 180,
    marginTop: 12,
    borderRadius: 12,
  },
  */
  submitButton: {
    paddingVertical: 8,
  },
});
