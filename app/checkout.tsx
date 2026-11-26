import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    findNodeHandle,
    Image,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    UIManager,
    View,
} from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CelebrationBurst } from '@/components/celebration-burst';
import {
    FulfillmentCheckoutSection,
    type FulfillmentAvailability,
    type FulfillmentCheckoutHandle,
} from '@/components/checkout/fulfillment-section';
import { DatePickerField } from '@/components/date-picker-field';
import { DetailHeaderBar } from '@/components/detail-header-bar';
import { InlineErrorBanner } from '@/components/inline-error-banner';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { OrderSuccessModal } from '@/components/order-success-modal';
import type { FulfillmentMethod } from '@/types/pickup-point';
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
import {
    fetchShopPayments,
    isWalletPayment,
    resolvePaymentMediaUrl,
    type ShopPaymentMethod,
} from '@/services/shop-payments-api';
import { openStoreReviewPage, shouldAutoPromptStoreRating } from '@/services/store-review';
import { uploadPaymentSlip } from '@/services/upload-api';
import { formatAddressLine } from '@/types/address';
import { formatPrice, unitPriceForQty } from '@/types/product';
import { hapticSuccess } from '@/utils/haptics';
import { isLiquidUiEnabled } from '@/utils/liquid-ui';

export default function CheckoutScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { token, user } = useAuth();
  const { productItems, clearCart, syncDeliveryFee } = useCart();
  const { language, t, fs, lh } = useLanguage();
  const liquid = isLiquidUiEnabled();
  const fulfillmentRef = useRef<FulfillmentCheckoutHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const notesFieldRef = useRef<View>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('delivery');
  const [fulfillmentClosed, setFulfillmentClosed] = useState(false);
  const [quotedFeeKs, setQuotedFeeKs] = useState(0);

  const checkoutShopId = useMemo(() => {
    for (const item of productItems) {
      const id = String(item.product.shopId || '').trim();
      if (id) return id;
      const raw = String(item.product.id || '');
      const idx = raw.indexOf('__');
      if (idx > 0) return raw.slice(0, idx);
    }
    return '';
  }, [productItems]);

  const displayTotal = useMemo(() => {
    const productsTotal = productItems.reduce(
      (sum, item) => sum + unitPriceForQty(item.product, item.quantity) * item.quantity,
      0,
    );
    const fee = fulfillmentMethod === 'pickup' || fulfillmentClosed ? 0 : quotedFeeKs;
    return productsTotal + fee;
  }, [fulfillmentClosed, fulfillmentMethod, productItems, quotedFeeKs]);

  const deliveryFeeAmount =
    fulfillmentMethod === 'pickup' || fulfillmentClosed ? 0 : Math.max(0, quotedFeeKs);
  const deliveryFeeLabel = formatPrice(deliveryFeeAmount);

  const [paymentMethods, setPaymentMethods] = useState<ShopPaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [slipLocalUri, setSlipLocalUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [promptStoreRating, setPromptStoreRating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddressError = useCallback((message: string) => {
    setError(message);
  }, []);

  const handleFulfillmentChange = useCallback((method: FulfillmentMethod) => {
    setFulfillmentMethod(method);
    if (method === 'pickup') {
      setPreferredDeliveryDate('');
      setDeliveryNotes('');
    }
  }, []);

  const handleAddressSelectionChange = useCallback((_addressId: string | null) => {
    // Township / fee refresh is handled inside FulfillmentCheckoutSection.
  }, []);

  const handleAvailabilityChange = useCallback((availability: FulfillmentAvailability) => {
    setFulfillmentClosed(availability.closed);
    setQuotedFeeKs(availability.feeKs);
  }, []);

  useEffect(() => {
    void syncDeliveryFee({ mode: 'pickup' });
  }, [syncDeliveryFee]);

  useEffect(() => {
    if (!checkoutShopId) {
      setPaymentMethods([]);
      return;
    }
    let cancelled = false;
    void fetchShopPayments(checkoutShopId)
      .then((methods) => {
        if (cancelled) return;
        setPaymentMethods(methods);
        setPaymentMethod((current) =>
          methods.some((m) => m.id === current) ? current : methods[0]?.id || 'cod',
        );
      })
      .catch(() => {
        if (cancelled) return;
        setPaymentMethods([
          {
            id: 'cod',
            enabled: true,
            qrUrl: null,
            label: 'Cash on delivery',
            shortLabel: 'COD',
            needsQr: false,
          },
        ]);
        setPaymentMethod('cod');
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutShopId]);

  useEffect(() => {
    if (!isWalletPayment(paymentMethod)) {
      setSlipLocalUri(null);
    }
  }, [paymentMethod]);

  const selectedPayment = useMemo(
    () => paymentMethods.find((m) => m.id === paymentMethod) || paymentMethods[0] || null,
    [paymentMethod, paymentMethods],
  );
  const walletSelected = isWalletPayment(paymentMethod);
  const walletQrUri = resolvePaymentMediaUrl(selectedPayment?.qrUrl);

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

  const pickSlip = async () => {
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
      setSlipLocalUri(result.assets[0].uri);
      setError('');
    }
  };

  const handleCheckout = async () => {
    if (!token) {
      setError(t('checkout.errorNotSignedIn'));
      return;
    }

    if (!productItems.length) {
      setError(t('checkout.errorEmptyCart'));
      return;
    }

    if (walletSelected && !slipLocalUri) {
      setError(t('checkout.errorUploadScreenshot'));
      return;
    }

    if (fulfillmentClosed) {
      setError(t('fulfillment.closedCheckout'));
      return;
    }

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

      let paymentSlipUrl: string | undefined;
      if (walletSelected && slipLocalUri) {
        paymentSlipUrl = await uploadPaymentSlip(token, slipLocalUri);
      }

      const isDoor =
        selection.fulfillmentMethod === 'delivery' ||
        selection.fulfillmentMethod === 'express';
      await checkoutOrder(token, {
        paymentMethod,
        paymentSlipUrl,
        preferredDeliveryDate: isDoor ? preferredDeliveryDate.trim() : '',
        deliveryNotes: isDoor ? deliveryNotes.trim() : '',
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
        {token && checkoutShopId ? (
          <FulfillmentCheckoutSection
            ref={fulfillmentRef}
            token={token}
            shopId={checkoutShopId}
            onError={handleAddressError}
            onFulfillmentChange={handleFulfillmentChange}
            onAddressSelectionChange={handleAddressSelectionChange}
            onAvailabilityChange={handleAvailabilityChange}
          />
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text, fontSize: fs(16), lineHeight: lh(16) }]}>{t('checkout.orderSummary')}</Text>

          {productItems.map((item) => {
            const unit = unitPriceForQty(item.product, item.quantity);
            const lineTotal = unit * item.quantity;

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
                  {t('orderDetail.qty')}: {item.quantity} × {formatPrice(unit)}
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
              {formatPrice(displayTotal)}
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text
            style={[
              styles.paymentEyebrow,
              { color: colors.textMuted, fontSize: fs(11), lineHeight: lh(11) },
            ]}>
            {t('checkout.payment')}
          </Text>
          <View style={styles.paymentChips}>
            {paymentMethods.map((method) => {
              const selected = method.id === paymentMethod;
              const label =
                method.id === 'cod'
                  ? fulfillmentMethod === 'pickup'
                    ? t('checkout.cash')
                    : t('checkout.cod')
                  : method.shortLabel || method.label;
              return (
                <Pressable
                  key={method.id}
                  onPress={() => setPaymentMethod(method.id)}
                  style={[
                    styles.paymentChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primaryMuted : colors.surface,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}>
                  <Text
                    style={{
                      color: selected ? colors.primary : colors.text,
                      fontSize: fs(13),
                      fontWeight: '600',
                    }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fs(12), lineHeight: lh(12), marginTop: 8 }}>
            {walletSelected
              ? t('checkout.scanWallet', {
                  wallet: selectedPayment?.shortLabel || selectedPayment?.label || paymentMethod,
                })
              : t('checkout.payOnReceive')}
          </Text>

          {walletSelected ? (
            <View style={styles.walletBlock}>
              {walletQrUri ? (
                <Image source={{ uri: walletQrUri }} style={styles.walletQr} resizeMode="contain" />
              ) : (
                <Text style={{ color: colors.danger, fontSize: fs(12), lineHeight: lh(12) }}>
                  {t('checkout.scanWallet', {
                    wallet: selectedPayment?.shortLabel || paymentMethod,
                  })}
                </Text>
              )}
              <Text
                style={{
                  color: colors.text,
                  fontSize: fs(12),
                  fontWeight: '600',
                  marginTop: 12,
                }}>
                {t('checkout.transferSlipRequired')}
              </Text>
              {slipLocalUri ? (
                <Image source={{ uri: slipLocalUri }} style={styles.slipPreview} resizeMode="cover" />
              ) : null}
              <View style={styles.slipActions}>
                <Button mode="outlined" icon="camera" onPress={pickSlip} style={styles.uploadButton}>
                  {slipLocalUri ? t('checkout.replaceSlip') : t('checkout.uploadScreenshot')}
                </Button>
                {slipLocalUri ? (
                  <Pressable onPress={() => setSlipLocalUri(null)}>
                    <Text style={{ color: colors.textMuted, fontSize: fs(12), fontWeight: '600' }}>
                      {t('checkout.removeSlip')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {fulfillmentMethod === 'delivery' || fulfillmentMethod === 'express' ? (
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
        ) : null}

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
          disabled={isSubmitting || fulfillmentClosed || !checkoutShopId}
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
  paymentEyebrow: {
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  paymentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  walletBlock: {
    marginTop: 12,
  },
  walletQr: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    borderRadius: 12,
  },
  slipPreview: {
    width: 160,
    height: 160,
    alignSelf: 'center',
    borderRadius: 12,
    marginTop: 10,
  },
  slipActions: {
    marginTop: 12,
    gap: 10,
    alignItems: 'flex-start',
  },
  uploadButton: {
    alignSelf: 'stretch',
  },
  submitButton: {
    paddingVertical: 8,
  },
});
