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
import { Button, HelperText, RadioButton } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CelebrationBurst } from '@/components/celebration-burst';
import {
    FulfillmentCheckoutSection,
    type FulfillmentCheckoutHandle,
} from '@/components/checkout/fulfillment-section';
import { DatePickerField } from '@/components/date-picker-field';
import { DetailHeaderBar } from '@/components/detail-header-bar';
import { InlineErrorBanner } from '@/components/inline-error-banner';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { OrderSuccessModal } from '@/components/order-success-modal';
import type { FulfillmentMethod } from '@/types/pickup-point';
// const KPAY_QR_IMAGE = require('@/assets/images/kpay-qr.png');
import { MYANMAR_FONTS } from '@/constants/fonts';
import { inputCaretProps } from '@/constants/text-input';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { fetchAddresses } from '@/services/address-api';
import { getUserFacingError } from '@/services/auth-error';
import { checkoutOrder } from '@/services/order-api';
import { openStoreReviewPage, shouldAutoPromptStoreRating } from '@/services/store-review';
import { formatAddressLine } from '@/types/address';
import { formatPrice } from '@/types/product';
import { hapticSuccess } from '@/utils/haptics';
import { isLiquidUiEnabled } from '@/utils/liquid-ui';

// Keep wire_transfer in the type for when KPay / wire transfer is re-enabled.
type PaymentMethod = 'cod' | 'wire_transfer';

export default function CheckoutScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { token, user } = useAuth();
  const { productItems, totalAmount, deliveryFeeAmount, isDeliveryFeeLoading, clearCart, syncDeliveryFee } = useCart();
  const { language, t, fs, lh } = useLanguage();
  const liquid = isLiquidUiEnabled();
  const fulfillmentRef = useRef<FulfillmentCheckoutHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const notesFieldRef = useRef<View>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('delivery');

  const deliveryFeeLabel = useMemo(() => {
    if (isDeliveryFeeLoading && deliveryFeeAmount <= 0) {
      return t('cart.deliveryLoading');
    }
    if (deliveryFeeAmount > 0) {
      return formatPrice(deliveryFeeAmount);
    }
    return t('cart.deliveryFree');
  }, [deliveryFeeAmount, isDeliveryFeeLoading, t]);

  const handleAddressError = useCallback((message: string) => {
    setError(message);
  }, []);

  const handleFulfillmentChange = useCallback(
    (method: FulfillmentMethod) => {
      setFulfillmentMethod(method);
      if (method === 'pickup') {
        void syncDeliveryFee({ mode: 'pickup' });
        return;
      }
      if (selectedAddressId) {
        void syncDeliveryFee({ addressId: selectedAddressId, mode: 'delivery' });
      } else {
        void syncDeliveryFee({ mode: 'delivery' });
      }
    },
    [selectedAddressId, syncDeliveryFee],
  );

  const handleAddressSelectionChange = useCallback(
    (addressId: string | null) => {
      setSelectedAddressId(addressId);
      if (fulfillmentMethod !== 'delivery') {
        return;
      }
      if (addressId) {
        void syncDeliveryFee({ addressId, mode: 'delivery' });
      } else {
        void syncDeliveryFee({ mode: 'delivery' });
      }
    },
    [fulfillmentMethod, syncDeliveryFee],
  );

  useEffect(() => {
    void syncDeliveryFee({ mode: 'delivery' });
  }, [syncDeliveryFee]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  // const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [promptStoreRating, setPromptStoreRating] = useState(false);
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

    if (!productItems.length) {
      setError(t('checkout.errorEmptyCart'));
      return;
    }

    /*
    if (paymentMethod === 'wire_transfer' && !screenshotUri) {
      setError(t('checkout.errorUploadScreenshot'));
      return;
    }
    */

    setError('');
    setIsSubmitting(true);

    try {
      const selection = await fulfillmentRef.current?.resolveSelection();

      if (!selection) {
        throw new Error(
          fulfillmentMethod === 'pickup'
            ? t('checkout.errorSelectPickup')
            : t('checkout.errorSelectAddress'),
        );
      }

      const addresses = await fetchAddresses(token);
      const selected = addresses.find((a) => a.id === String(selection.addressId));
      const addressText = selected
        ? formatAddressLine(selected) || String(selected.street || selected.city || '')
        : '';
      const townshipId = selected?.zip ? String(selected.zip) : undefined;

      await checkoutOrder(token, {
        paymentMethod,
        preferredDeliveryDate,
        deliveryNotes,
        fulfillmentMethod: selection.fulfillmentMethod,
        addressId: String(selection.addressId),
        addressText: addressText || undefined,
        townshipId,
        buyerName: user?.name || undefined,
        buyerPhone: user?.phone || user?.login || undefined,
        pickupPointId:
          selection.fulfillmentMethod === 'pickup' ? String(selection.pickupPointId) : '',
        items: productItems.map((item) => ({
          product_id: String(item.product.id),
          quantity: item.quantity,
          shop_id: item.product.shopId,
          sku_id: item.product.productId,
        })),
      });

      clearCart();
      hapticSuccess();
      setShowCelebration(true);
      const canAskRating = await shouldAutoPromptStoreRating();
      setPromptStoreRating(canAskRating);
      setShowSuccessModal(true);
    } catch (err) {
      const message = getUserFacingError(err, t('errors.checkoutFailed'), t);
      if (message) setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={liquid ? [] : ['top']}>
      <DetailHeaderBar title={t('checkout.title')} />

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

          {productItems.map((item) => {
            const lineTotal = item.product.list_price * item.quantity;

            return (
              <View
                key={item.product.id}
                style={[styles.summaryLine, { borderBottomColor: colors.border }]}>
                <View style={styles.summaryLineTop}>
                  <Text
                    style={[styles.summaryLineName, { color: colors.text, fontSize: fs(15), lineHeight: lh(15) }]}
                    numberOfLines={2}>
                    {item.product.name}
                  </Text>
                  <Text
                    style={[styles.summaryLineTotal, { color: colors.primary, fontSize: fs(15), lineHeight: lh(15) }]}>
                    {formatPrice(lineTotal)}
                  </Text>
                </View>
                <Text style={[styles.summaryLineMeta, { color: colors.textMuted, fontSize: fs(13), lineHeight: lh(13) }]}>
                  {t('orderDetail.qty')}: {item.quantity} × {formatPrice(item.product.list_price)}
                </Text>
              </View>
            );
          })}

          <View style={[styles.summaryLine, { borderBottomColor: colors.border }]}>
            <View style={styles.summaryLineTop}>
              <Text style={[styles.summaryLineName, { color: colors.text, fontSize: fs(15), lineHeight: lh(15) }]}>
                {t('cart.deliveryFee')}
              </Text>
              <Text style={[styles.summaryLineTotal, { color: colors.primary, fontSize: fs(15), lineHeight: lh(15) }]}>
                {deliveryFeeLabel}
              </Text>
            </View>
          </View>

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
          <FulfillmentCheckoutSection
            ref={fulfillmentRef}
            token={token}
            onError={handleAddressError}
            onFulfillmentChange={handleFulfillmentChange}
            onAddressSelectionChange={handleAddressSelectionChange}
          />
        ) : null}

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
              multiline
              textAlignVertical="top"
              style={[
                styles.notesInput,
                {
                  color: colors.text,
                  fontSize: fs(15),
                  // Myanmar glyphs need room — never force a tight height/lineHeight.
                  ...(language === 'my'
                    ? { fontFamily: MYANMAR_FONTS.regular }
                    : null),
                },
              ]}
              {...inputCaretProps(isDark)}
            />
          </View>
        </View>

        {error ? (
          <InlineErrorBanner
            message={error}
            onDismiss={() => setError('')}
            style={{ marginHorizontal: 0, marginBottom: 12 }}
          />
        ) : null}

        <Button
          mode="contained"
          onPress={handleCheckout}
          loading={isSubmitting}
          disabled={isSubmitting}
          contentStyle={styles.submitButton}>
          {t('checkout.placeOrder')}
        </Button>
      </KeyboardAwareScrollView>

      <OrderSuccessModal
        visible={showSuccessModal}
        onDone={() => {
          setShowSuccessModal(false);
          if (promptStoreRating) {
            void openStoreReviewPage();
          }
          router.replace('/(tabs)/orders' as Href);
        }}
      />

      <CelebrationBurst active={showCelebration} onFinished={() => setShowCelebration(false)} />
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
  summaryLineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLineName: {
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
  summaryLineMeta: {
    marginTop: 4,
  },
  summaryLineTotal: {
    flexShrink: 0,
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
    minHeight: 48,
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
