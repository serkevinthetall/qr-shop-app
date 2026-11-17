import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, HelperText } from 'react-native-paper';

import {
  AddressCheckoutSection,
  type AddressCheckoutHandle,
} from '@/components/checkout/address-section';
import { LiquidSurface } from '@/components/liquid-surface';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { fetchAddresses } from '@/services/address-api';
import { getUserFacingError } from '@/services/auth-error';
import { fetchPickupPoints } from '@/services/pickup-point-api';
import {
  fetchShopContact,
  fetchShopDeliveryQuote,
  fetchShopDeliverySettings,
} from '@/services/shop-delivery-api';
import { getDeliveryAddresses, getMainAddress } from '@/types/address';
import type { FulfillmentMethod, PickupPoint } from '@/types/pickup-point';
import { formatPrice } from '@/types/product';
import {
  isLiquidUiEnabled,
  liquidGlassBorder,
  liquidGlassFill,
} from '@/utils/liquid-ui';

export type FulfillmentCheckoutHandle = {
  resolveSelection: () => Promise<
    | { fulfillmentMethod: 'pickup'; pickupPointId: string; addressId: string }
    | { fulfillmentMethod: 'delivery'; addressId: string }
    | { fulfillmentMethod: 'express'; addressId: string }
  >;
};

export type FulfillmentAvailability = {
  closed: boolean;
  canPickup: boolean;
  canDelivery: boolean;
  canExpress: boolean;
  feeKs: number;
  shopPhone: string;
};

type FulfillmentCheckoutSectionProps = {
  token: string;
  shopId: string;
  onError: (message: string) => void;
  onFulfillmentChange: (method: FulfillmentMethod) => void;
  onAddressSelectionChange?: (addressId: string | null) => void;
  onAvailabilityChange?: (availability: FulfillmentAvailability) => void;
};

function MethodSegment({
  label,
  selected,
  onPress,
  colors,
  fontSize,
  liquid,
  idleFill,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useAppColors>;
  fontSize: number;
  liquid: boolean;
  idleFill: string;
}) {
  const selectedBg = liquid ? colors.primaryContainer : colors.primary;
  const selectedFg = liquid ? colors.onPrimaryContainer : colors.onPrimary;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segment,
        {
          backgroundColor: selected ? selectedBg : idleFill,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <Text
        style={[
          styles.segmentLabel,
          {
            color: selected ? selectedFg : colors.textMuted,
            fontSize,
            fontWeight: selected ? '700' : '600',
          },
        ]}
        numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function pickPreferredMethod(opts: {
  canPickup: boolean;
  canDelivery: boolean;
  canExpress: boolean;
  preferred?: FulfillmentMethod | null;
}): FulfillmentMethod | null {
  const { canPickup, canDelivery, canExpress, preferred } = opts;
  if (preferred === 'delivery' && canDelivery) return 'delivery';
  if (preferred === 'express' && canExpress) return 'express';
  if (preferred === 'pickup' && canPickup) return 'pickup';
  if (canDelivery) return 'delivery';
  if (canExpress) return 'express';
  if (canPickup) return 'pickup';
  return null;
}

export const FulfillmentCheckoutSection = forwardRef<
  FulfillmentCheckoutHandle,
  FulfillmentCheckoutSectionProps
>(function FulfillmentCheckoutSection(
  {
    token,
    shopId,
    onError,
    onFulfillmentChange,
    onAddressSelectionChange,
    onAvailabilityChange,
  },
  ref,
) {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const liquid = isLiquidUiEnabled();
  const trackBorder = liquid ? liquidGlassBorder(isDark) : colors.border;
  const idleFill = liquid ? liquidGlassFill(isDark) : 'transparent';
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;

  const addressRef = useRef<AddressCheckoutHandle>(null);
  const [method, setMethod] = useState<FulfillmentMethod | null>('delivery');
  const buyerChoiceRef = useRef<FulfillmentMethod | null>(null);
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedPickupId, setSelectedPickupId] = useState<number | null>(null);
  const selectedPickupIdRef = useRef<number | null>(null);
  /** Silent contact address for pickup orders. */
  const selectedContactIdRef = useRef<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [townshipId, setTownshipId] = useState<string | null>(null);
  const [isLoadingPickup, setIsLoadingPickup] = useState(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [pickupError, setPickupError] = useState('');
  const [canPickup, setCanPickup] = useState(true);
  const [canDelivery, setCanDelivery] = useState(false);
  const [canExpress, setCanExpress] = useState(false);
  /** Shop-level toggles (before township quote). */
  const [shopDeliveryOn, setShopDeliveryOn] = useState(false);
  const [shopExpressOn, setShopExpressOn] = useState(false);
  const [deliveryFeeKs, setDeliveryFeeKs] = useState<number | null>(null);
  const [expressFeeKs, setExpressFeeKs] = useState<number | null>(null);
  const [shopPhone, setShopPhone] = useState('');
  const [optionsReady, setOptionsReady] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onAvailabilityChangeRef = useRef(onAvailabilityChange);
  onAvailabilityChangeRef.current = onAvailabilityChange;

  const selectPickupId = useCallback((id: number | null) => {
    selectedPickupIdRef.current = id;
    setSelectedPickupId(id);
  }, []);

  const emitAvailability = useCallback(
    (next: {
      canPickup: boolean;
      canDelivery: boolean;
      canExpress: boolean;
      method: FulfillmentMethod | null;
      deliveryFeeKs: number | null;
      expressFeeKs: number | null;
      shopPhone: string;
      closed?: boolean;
    }) => {
      const closed =
        next.closed ??
        (!next.canPickup && !next.canDelivery && !next.canExpress);
      let feeKs = 0;
      if (next.method === 'delivery') feeKs = next.deliveryFeeKs ?? 0;
      if (next.method === 'express') feeKs = next.expressFeeKs ?? 0;
      onAvailabilityChangeRef.current?.({
        closed,
        canPickup: next.canPickup,
        canDelivery: next.canDelivery,
        canExpress: next.canExpress,
        feeKs,
        shopPhone: next.shopPhone,
      });
    },
    [],
  );

  const setFulfillment = useCallback(
    (next: FulfillmentMethod) => {
      buyerChoiceRef.current = next;
      setMethod(next);
      onFulfillmentChange(next);
    },
    [onFulfillmentChange],
  );

  const loadPickupPoints = useCallback(async () => {
    setIsLoadingPickup(true);
    try {
      const points = await fetchPickupPoints(token);
      setPickupPoints(points);
      setPickupError('');

      if (selectedPickupIdRef.current && points.some((p) => p.id === selectedPickupIdRef.current)) {
        selectPickupId(selectedPickupIdRef.current);
      } else {
        selectPickupId(points[0]?.id ?? null);
      }
    } catch (err) {
      const message = getUserFacingError(err, t('errors.loadPickupPoints'));
      setPickupPoints([]);
      selectPickupId(null);
      if (message) {
        setPickupError(message);
        onErrorRef.current(message);
      }
    } finally {
      setIsLoadingPickup(false);
    }
  }, [selectPickupId, t, token]);

  const resolveMainContactId = useCallback(async () => {
    const list = getDeliveryAddresses(await fetchAddresses(token));
    const main = getMainAddress(list);
    const contactId = main?.id ?? list[0]?.id ?? null;
    selectedContactIdRef.current = contactId;
    return contactId;
  }, [token]);

  const loadContactAddresses = useCallback(async () => {
    try {
      await resolveMainContactId();
    } catch {
      selectedContactIdRef.current = null;
    }
  }, [resolveMainContactId]);

  const refreshTownshipFromAddress = useCallback(
    async (addressId: string | null) => {
      if (!addressId) {
        setTownshipId(null);
        return null;
      }
      try {
        const list = await fetchAddresses(token);
        const hit = list.find((a) => String(a.id) === String(addressId));
        const zip = hit?.zip ? String(hit.zip) : null;
        setTownshipId(zip);
        return zip;
      } catch {
        setTownshipId(null);
        return null;
      }
    },
    [token],
  );

  const handleAddressSelectionChange = useCallback(
    (addressId: string | null) => {
      setSelectedAddressId(addressId);
      onAddressSelectionChange?.(addressId);
      void refreshTownshipFromAddress(addressId);
    },
    [onAddressSelectionChange, refreshTownshipFromAddress],
  );

  useEffect(() => {
    void loadPickupPoints();
    void loadContactAddresses();
  }, [loadContactAddresses, loadPickupPoints]);

  /** Seed township from the buyer's default address so Delivery/Express can unlock. */
  useEffect(() => {
    let cancelled = false;
    async function seedTownship() {
      try {
        const list = getDeliveryAddresses(await fetchAddresses(token));
        const main = getMainAddress(list);
        const preferred = list.find((a) => a.isDefault) || main || list[0] || null;
        if (cancelled || !preferred) return;
        setSelectedAddressId(String(preferred.id));
        const zip = preferred.zip ? String(preferred.zip) : null;
        setTownshipId(zip);
        onAddressSelectionChange?.(String(preferred.id));
      } catch {
        // Address load failures surface elsewhere.
      }
    }
    void seedTownship();
    return () => {
      cancelled = true;
    };
  }, [onAddressSelectionChange, token]);

  useEffect(() => {
    let cancelled = false;

    async function loadShopPhone() {
      if (!shopId) {
        setShopPhone('');
        return;
      }
      try {
        const contact = await fetchShopContact(shopId);
        if (!cancelled) setShopPhone(contact.phone);
      } catch {
        if (!cancelled) setShopPhone('');
      }
    }

    void loadShopPhone();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      if (!shopId) {
        setCanPickup(false);
        setCanDelivery(false);
        setCanExpress(false);
        setIsLoadingOptions(false);
        emitAvailability({
          canPickup: false,
          canDelivery: false,
          canExpress: false,
          method: null,
          deliveryFeeKs: null,
          expressFeeKs: null,
          shopPhone,
        });
        return;
      }

      setIsLoadingOptions(true);
      try {
        const settings = await fetchShopDeliverySettings(shopId);
        if (cancelled) return;
        setShopDeliveryOn(settings.deliveryEnabled);
        setShopExpressOn(settings.expressEnabled);

        let nextCanPickup = settings.pickupEnabled;
        let nextCanDelivery = false;
        let nextCanExpress = false;
        let nextDeliveryFee: number | null = null;
        let nextExpressFee: number | null = null;

        if (townshipId) {
          const quote = await fetchShopDeliveryQuote(shopId, townshipId);
          if (cancelled) return;
          nextCanPickup = quote.canPickup;
          nextCanDelivery = quote.canDelivery;
          nextCanExpress = quote.canExpress;
          nextDeliveryFee = quote.deliveryFeeKs;
          nextExpressFee = quote.expressFeeKs;
        }

        setCanPickup(nextCanPickup);
        setCanDelivery(nextCanDelivery);
        setCanExpress(nextCanExpress);
        setDeliveryFeeKs(nextDeliveryFee);
        setExpressFeeKs(nextExpressFee);
        setOptionsReady(true);

        const nextMethod = pickPreferredMethod({
          canPickup: nextCanPickup,
          canDelivery: nextCanDelivery,
          canExpress: nextCanExpress,
          preferred: buyerChoiceRef.current,
        });
        setMethod(nextMethod);
        if (nextMethod) {
          onFulfillmentChange(nextMethod);
        }

        const nextClosed =
          (!nextCanPickup && !settings.deliveryEnabled && !settings.expressEnabled) ||
          (Boolean(townshipId) && !nextCanPickup && !nextCanDelivery && !nextCanExpress);

        emitAvailability({
          canPickup: nextCanPickup,
          canDelivery: nextCanDelivery,
          canExpress: nextCanExpress,
          method: nextMethod,
          deliveryFeeKs: nextDeliveryFee,
          expressFeeKs: nextExpressFee,
          shopPhone,
          closed: nextClosed,
        });
      } catch (err) {
        if (cancelled) return;
        const message = getUserFacingError(err, t('fulfillment.loadingOptions'));
        if (message) onErrorRef.current(message);
        setCanPickup(false);
        setCanDelivery(false);
        setCanExpress(false);
        setShopDeliveryOn(false);
        setShopExpressOn(false);
        setOptionsReady(true);
        setMethod(null);
        emitAvailability({
          canPickup: false,
          canDelivery: false,
          canExpress: false,
          method: null,
          deliveryFeeKs: null,
          expressFeeKs: null,
          shopPhone,
          closed: true,
        });
      } finally {
        if (!cancelled) setIsLoadingOptions(false);
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [emitAvailability, onFulfillmentChange, shopId, shopPhone, t, townshipId]);

  useImperativeHandle(
    ref,
    () => ({
      resolveSelection: async () => {
        if (!method || (!canPickup && !canDelivery && !canExpress)) {
          throw new Error(t('fulfillment.closedCheckout'));
        }

        if (method === 'pickup') {
          const pickupPointId = selectedPickupIdRef.current
            ? String(selectedPickupIdRef.current)
            : pickupPoints.length
              ? ''
              : 'shop';
          if (!pickupPointId) {
            throw new Error(t('checkout.errorSelectPickup'));
          }

          let addressId = selectedContactIdRef.current;
          if (!addressId) {
            try {
              addressId = await resolveMainContactId();
            } catch {
              addressId = null;
            }
          }
          if (!addressId) {
            throw new Error(t('checkout.errorSelectContact'));
          }
          return { fulfillmentMethod: 'pickup', pickupPointId, addressId };
        }

        const addressId = await addressRef.current?.resolveAddressId();
        if (!addressId) {
          throw new Error(t('checkout.errorSelectAddress'));
        }
        if (method === 'express') {
          return { fulfillmentMethod: 'express', addressId };
        }
        return { fulfillmentMethod: 'delivery', addressId };
      },
    }),
    [
      canDelivery,
      canExpress,
      canPickup,
      method,
      pickupPoints.length,
      resolveMainContactId,
      t,
    ],
  );

  const selectedPickup =
    pickupPoints.find((point) => Number(point.id) === Number(selectedPickupId)) ?? null;

  const segmentFontSize = fs(rs(14)) ?? rs(14);
  const chipCount = Number(canPickup) + Number(canDelivery) + Number(canExpress);
  const shopFullyOff = !canPickup && !shopDeliveryOn && !shopExpressOn;
  const locationClosed = Boolean(townshipId) && chipCount === 0;
  const closed = optionsReady && !isLoadingOptions && (shopFullyOff || locationClosed);
  /** Need an address to unlock Delivery/Express when township not known yet. */
  const needsAddressToUnlock =
    optionsReady &&
    !closed &&
    !townshipId &&
    !canDelivery &&
    !canExpress &&
    (shopDeliveryOn || shopExpressOn);
  const showSegments = !isLoadingOptions && !closed && chipCount >= 2;
  const activeFee =
    method === 'express' ? expressFeeKs : method === 'delivery' ? deliveryFeeKs : 0;
  const showAddressPanel =
    !closed &&
    !isLoadingOptions &&
    (method === 'delivery' || method === 'express' || needsAddressToUnlock);

  useEffect(() => {
    if (!optionsReady) return;
    const nextClosed =
      (!canPickup && !shopDeliveryOn && !shopExpressOn) ||
      (Boolean(townshipId) && !canPickup && !canDelivery && !canExpress);
    // Keep parent fee label / closed flag in sync when method changes.
    emitAvailability({
      canPickup,
      canDelivery,
      canExpress,
      method,
      deliveryFeeKs,
      expressFeeKs,
      shopPhone,
      closed: nextClosed,
    });
  }, [
    canDelivery,
    canExpress,
    canPickup,
    deliveryFeeKs,
    emitAvailability,
    expressFeeKs,
    method,
    optionsReady,
    shopDeliveryOn,
    shopExpressOn,
    shopPhone,
    townshipId,
  ]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
        {t('fulfillment.howToFulfill')}
      </Text>

      {isLoadingOptions ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textMuted, marginLeft: 10, lineHeight: lh(14) }}>
            {t('fulfillment.loadingOptions')}
          </Text>
        </View>
      ) : null}

      {closed ? (
        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive
          cornerRadius={16}>
          <Text
            style={[
              styles.closedTitle,
              { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) },
            ]}>
            {t('fulfillment.closedCheckout')}
          </Text>
          {shopPhone ? (
            <Pressable
              onPress={() => {
                void Linking.openURL(`tel:${shopPhone.replace(/[^\d+]/g, '')}`);
              }}
              accessibilityRole="link">
              <Text
                style={[
                  styles.closedPhone,
                  { color: colors.primary, fontSize: fs(rs(15)), lineHeight: lh(15) },
                ]}>
                {t('fulfillment.closedCheckoutCall', { phone: shopPhone })}
              </Text>
            </Pressable>
          ) : (
            <Text
              style={{ color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13), marginTop: 8 }}>
              {t('fulfillment.closedCheckoutNoPhone')}
            </Text>
          )}
        </LiquidSurface>
      ) : null}

      {showSegments ? (
        <LiquidSurface
          style={[styles.segmentTrack, { borderColor: trackBorder }]}
          backgroundColor={colors.inputBg}
          glassStyle="regular"
          interactive
          cornerRadius={14}>
          {canDelivery ? (
            <MethodSegment
              label={t('fulfillment.delivery')}
              selected={method === 'delivery'}
              onPress={() => setFulfillment('delivery')}
              colors={colors}
              fontSize={segmentFontSize}
              liquid={liquid}
              idleFill={idleFill}
            />
          ) : null}
          {canExpress ? (
            <MethodSegment
              label={t('fulfillment.express')}
              selected={method === 'express'}
              onPress={() => setFulfillment('express')}
              colors={colors}
              fontSize={segmentFontSize}
              liquid={liquid}
              idleFill={idleFill}
            />
          ) : null}
          {canPickup ? (
            <MethodSegment
              label={t('fulfillment.selfPickup')}
              selected={method === 'pickup'}
              onPress={() => setFulfillment('pickup')}
              colors={colors}
              fontSize={segmentFontSize}
              liquid={liquid}
              idleFill={idleFill}
            />
          ) : null}
        </LiquidSurface>
      ) : null}

      {!closed && !isLoadingOptions && method === 'pickup' ? (
        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive
          cornerRadius={16}>
          <View>
            <Text
              style={[
                styles.hintLabel,
                { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
              ]}>
              {t('fulfillment.choosePickup')}
            </Text>

            {isLoadingPickup ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textMuted, marginLeft: 10, lineHeight: lh(14) }}>
                  {t('fulfillment.loadingPickup')}
                </Text>
              </View>
            ) : (
              <>
                {pickupError ? <HelperText type="info">{pickupError}</HelperText> : null}

                {!pickupPoints.length ? (
                  <View style={[styles.emptyBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    <Text
                      style={[
                        styles.emptyTitle,
                        { color: colors.text, fontSize: fs(rs(15)), lineHeight: lh(15) },
                      ]}>
                      {t('fulfillment.selfPickup')}
                    </Text>
                    <Text
                      style={{ color: colors.textMuted, fontSize: fs(rs(13)), lineHeight: lh(13) }}>
                      {t('fulfillment.choosePickup')}
                    </Text>
                  </View>
                ) : (
                  <>
                    {selectedPickup ? (
                      <View
                        style={[
                          styles.selectedCard,
                          {
                            backgroundColor: colors.primaryMuted,
                            borderColor: colors.primary,
                          },
                        ]}>
                        <Text style={[styles.selectedBadge, { color: colors.primary, lineHeight: lh(12) }]}>
                          {t('fulfillment.selected')}
                        </Text>
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: fs(rs(16)),
                            lineHeight: lh(16),
                            fontWeight: '600',
                          }}>
                          {selectedPickup.name}
                        </Text>
                        {selectedPickup.address ? (
                          <Text
                            style={{
                              color: colors.textMuted,
                              fontSize: fs(rs(13)),
                              lineHeight: lh(13),
                              marginTop: 4,
                            }}>
                            {selectedPickup.address}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {pickupPoints.map((point) => {
                      const isSelected = Number(selectedPickupId) === Number(point.id);

                      return (
                        <TouchableOpacity
                          key={point.id}
                          activeOpacity={0.75}
                          onPress={() => selectPickupId(point.id)}
                          style={[
                            styles.pointCard,
                            {
                              backgroundColor: isSelected ? colors.primaryMuted : colors.inputBg,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                          ]}>
                          <View
                            style={[
                              styles.radioOuter,
                              { borderColor: isSelected ? colors.primary : colors.border },
                            ]}>
                            {isSelected ? (
                              <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                            ) : null}
                          </View>
                          <View style={styles.pointContent}>
                            <Text
                              style={{
                                color: colors.text,
                                fontSize: fs(rs(15)),
                                lineHeight: lh(15),
                                fontWeight: '600',
                              }}>
                              {point.name}
                            </Text>
                            {point.address ? (
                              <Text
                                style={{
                                  color: colors.textMuted,
                                  fontSize: fs(rs(13)),
                                  lineHeight: lh(13),
                                  marginTop: 4,
                                }}>
                                {point.address}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {!selectedPickupId ? (
                      <HelperText type="error" visible>
                        {t('fulfillment.markPickup')}
                      </HelperText>
                    ) : null}
                  </>
                )}
              </>
            )}
          </View>
        </LiquidSurface>
      ) : null}

      {showAddressPanel ? (
        <LiquidSurface
          style={[styles.card, { borderColor: cardBorder }]}
          backgroundColor={colors.card}
          glassStyle="regular"
          interactive
          cornerRadius={16}>
          <View>
            {chipCount === 1 && method ? (
              <Text
                style={[
                  styles.hintLabel,
                  { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
                ]}>
                {method === 'express' ? t('fulfillment.express') : t('fulfillment.delivery')}
              </Text>
            ) : needsAddressToUnlock ? (
              <Text
                style={[
                  styles.hintLabel,
                  { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
                ]}>
                {t('fulfillment.deliveryAddress')}
              </Text>
            ) : null}
            {method && (method === 'delivery' || method === 'express') && activeFee != null ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: fs(rs(13)),
                  lineHeight: lh(13),
                  marginBottom: 10,
                }}>
                {t('fulfillment.feeLabel')}:{' '}
                {activeFee > 0 ? formatPrice(activeFee) : t('cart.deliveryFree')}
              </Text>
            ) : null}
            <AddressCheckoutSection
              ref={addressRef}
              token={token}
              onError={onError}
              onSelectionChange={handleAddressSelectionChange}
              embedded
            />
          </View>
        </LiquidSurface>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    paddingVertical: 2,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  segment: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    textAlign: 'center',
    paddingVertical: 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  hintLabel: {
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 12,
    paddingVertical: 2,
  },
  closedTitle: {
    fontWeight: '700',
  },
  closedPhone: {
    fontWeight: '600',
    marginTop: 10,
    textDecorationLine: 'underline',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  emptyTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  selectedCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  selectedBadge: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  pointCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pointContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    paddingTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
